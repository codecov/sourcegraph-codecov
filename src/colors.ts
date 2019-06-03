export function hsl(
    hue: number | string,
    saturation: number,
    lightness: number
): string {
    const sat = Math.floor(saturation * 100)
    const light = Math.floor(lightness * 100)
    return `hsl(${hue}, ${sat}%, ${light}%)`
}
