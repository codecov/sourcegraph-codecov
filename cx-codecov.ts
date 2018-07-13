import { createWebWorkerMessageTransports } from "cxp/lib/jsonrpc2/transports/webWorker";
import { InitializeResult, InitializeParams } from "cxp/lib/protocol";
import {
  TextDocumentDecoration,
  TextDocumentDecorationsParams
} from "cxp/lib/protocol/decorations";
import { Connection, createConnection } from "cxp/lib/server/server";
import { URI } from "cxp/lib/types/textDocument";

type ParsedURI =
  | {
      repo: string;
      rev: string;
      path?: string;
    }
  | { repo: undefined; rev: undefined; path: string };

function createServer(connection: Connection): void {
  let root: URI | null = null;
  let parsedRoot: ParsedURI | null = null;

  connection.onInitialize(
    (params: InitializeParams & { originalRootUri?: string }) => {
      // Use original root if proxied so we know which repository/revision this is for.
      root = params.originalRootUri || params.root || null;
      if (root) {
        parsedRoot = parseURI(root);
      }

      return {
        capabilities: { decorationsProvider: { static: true } }
      } as InitializeResult;
    }
  );

  connection.onTextDocumentDecorations(
    async (
      params: TextDocumentDecorationsParams
    ): Promise<TextDocumentDecoration[]> => {
      const { path } = parseURI(params.textDocument.uri);
      if (!parsedRoot || !parsedRoot.repo || !parsedRoot.rev || !path) {
        return [];
      }
      return codecovToDecorations(
        await getCoverageForFile(
          parsedRoot.repo,
          parsedRoot.rev,
          parsedRoot.path ? `${parsedRoot.path}/${path}` : path
        )
      );
    }
  );
}

/** Parse a URI of the forms git://github.com/owner/repo?rev#path and file:///path. */
function parseURI(uri: string): ParsedURI {
  const url = new URL(uri.replace(/^git:/, "http:"));
  if (url.protocol === "http:") {
    return {
      repo: url.host + url.pathname,
      rev: url.search.slice(1),
      path: url.hash.slice(1) || undefined
    };
  }
  if (url.protocol === "file:") {
    return { repo: undefined, rev: undefined, path: url.pathname };
  }
  throw new Error(
    `unrecognized URI: ${JSON.stringify(
      uri
    )} (supported URI schemes: git, file)`
  );
}

type FileCoverage = { [line: string]: LineCoverage };
type LineCoverage = number | { hits: number; branches: number };

const ALPHA = 0.25;
const RED_HUE = 0;
const YELLOW_HUE = 60;
const GREEN_HUE = 116;

function codecovToDecorations(
  lineCoverage: FileCoverage
): TextDocumentDecoration[] {
  return Object.keys(lineCoverage).map(line => {
    const decoration: TextDocumentDecoration = {
      range: {
        start: { line: parseInt(line) - 1, character: 0 },
        end: { line: parseInt(line) - 1, character: 1 }
      },
      isWholeLine: true,
      backgroundColor: lineColor(lineCoverage[line], 0.7, ALPHA)
    };
    if (true) {
      decoration.after = {
        backgroundColor: lineColor(lineCoverage[line], 0.7, 1),
        color: lineColor(lineCoverage[line], 0.25, 1),
        ...lineText(lineCoverage[line]),
        linkURL: "http://example.com"
      };
    }
    return decoration;
  });
}

function lineColor(
  coverage: LineCoverage,
  lightness: number,
  alpha: number
): string {
  let hue: number;
  if (coverage === 0 || coverage === null) {
    hue = RED_HUE;
  } else if (
    typeof coverage === "number" ||
    coverage.hits === coverage.branches
  ) {
    hue = GREEN_HUE;
  } else {
    hue = YELLOW_HUE; // partially covered
  }
  return `hsla(${hue}, 100%, ${lightness * 100}%, ${alpha})`;
}

function lineText(
  coverage: LineCoverage
): { contentText?: string; hoverMessage?: string } {
  if (typeof coverage === "number") {
    if (coverage >= 1) {
      return {
        contentText: ` ${coverage} `,
        hoverMessage: `${coverage} hit${coverage === 1 ? "" : "s"} (Codecov)`
      };
    }
    return { hoverMessage: "not covered by test (Codecov)" };
  }
  return {
    contentText: ` ${coverage.hits}/${coverage.branches} `,
    hoverMessage: `${coverage.hits}/${coverage.branches} branch${
      coverage.branches === 1 ? "" : "es"
    } hit (Codecov)`
  };
}

async function getCoverageForFile(
  repo: string,
  rev: string,
  path: string
): Promise<FileCoverage> {
  // TODO: support other code hosts
  const codeHost = "gh";
  repo = repo.replace(/^github\.com\//, "");

  // TODO: support self-hosted codecov (not just codecov.io)
  //
  // TODO: remove this cors-anywhere proxy when codecov supports CORS
  const corsAnywhereURL = "https://ca9911a.ngrok.io/";
  const resp = await fetch(
    `${corsAnywhereURL}https://codecov.io/api/${codeHost}/${repo}/commits/${rev}?src=extension`,
    {
      method: "GET",
      mode: "cors",
      credentials: "omit"
    }
  );
  const fileData = (await resp.json()).commit.report.files[path];
  return fileData ? asFileCoverage(fileData.l) : {};
}

/** Mutates data to make it a FileCoverage. */
function asFileCoverage(data: {
  [line: string]: number | string;
}): FileCoverage {
  const coverage: FileCoverage = data as any;
  for (const line of Object.keys(data)) {
    // We only need to parse strings; other types (number | null) can pass through unchanged.
    const value = data[line];
    if (typeof value === "string") {
      const [hits, branches] = value.split("/", 2).map(v => parseInt(v, 10));
      coverage[line] = { hits, branches };
    }
  }
  return coverage;
}

const connection = createConnection(
  createWebWorkerMessageTransports(self as DedicatedWorkerGlobalScope)
);
createServer(connection);
connection.listen();
