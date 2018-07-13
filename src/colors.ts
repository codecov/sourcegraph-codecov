export const RED_HUE = 0
export const YELLOW_HUE = 60
export const GREEN_HUE = 116

export function hsla(
    hue: number | string,
    lightness: number,
    alpha: number
): string {
    return `hsla(${hue}, 100%, ${lightness * 100}%, ${alpha})`
}
