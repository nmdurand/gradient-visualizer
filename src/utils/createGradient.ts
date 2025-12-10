import {
    converter,
    formatHex,
    interpolate,
    clampGamut,
    useMode as setMode,
    modeOklch,
    modeRgb,
    samples,
  } from 'culori/fn'
  import { assertIsDefined } from './assert'

  const LUMINANCE = [
    950, 900, 800, 700, 600, 500, 400, 300, 200, 100, 50,
  ] as const

  const BLACK = '#000000'
  const WHITE = '#FFFFFF'

  export type Gradient = Record<1000 | (typeof LUMINANCE)[number] | 0, string>

  export interface GradientOptions {
    /** Luminance of the darkest color (default: 0.2) */
    minL?: number
    /** Luminance of the lightest color (default: 0.98) */
    maxL?: number
    /** Chroma at dark end (default: 0.001) */
    darkChroma?: number
    /** Chroma at light end (default: 0.01) */
    lightChroma?: number
    /** Position of main color in gradient, 0-1 (default: 0.5) */
    mainColorStop?: number
  }

  export interface OklchPoint {
    l: number
    c: number
    h: number | undefined
  }

  export interface GradientWithOklch {
    gradient: Gradient
    oklchPoints: Record<1000 | (typeof LUMINANCE)[number] | 0, OklchPoint>
    mainColorOklch: OklchPoint
  }

  const DEFAULT_OPTIONS: Required<GradientOptions> = {
    minL: 0.2,
    maxL: 0.98,
    darkChroma: 0.001,
    lightChroma: 0.01,
    mainColorStop: 0.5,
  }

  export function createGradient(mainColor: string, options?: GradientOptions): Gradient {
    return createGradientWithOklch(mainColor, options).gradient
  }

  export function createGradientWithOklch(mainColor: string, options?: GradientOptions): GradientWithOklch {
    const opts = { ...DEFAULT_OPTIONS, ...options }
    
    // culori fn is a subset of the culori library, where we need to specify the modes we'll use
    setMode(modeOklch)
    setMode(modeRgb)

    // oklch is a color space that allows homogeneous interpolation between colors, contrary to RGB, where the luminance is not linear
    const oklch = converter('oklch')
    const clamp = clampGamut('oklch')

    // however oklch's gamut does not cover the full range of colors, so we need to clamp the color to have a fallback
    const lchMainColor = oklch(clamp(mainColor))
    assertIsDefined(lchMainColor)

    // we define the darkest color of the gradient, with a luminance of minL and low chroma
    // this color is dark and desaturated (tending towards black)
    // oklch is less precise with dark values, so we up the darkest luminance
    const lchDarkest = clamp({
      ...lchMainColor,
      mode: 'oklch' as const,
      l: opts.minL,
      c: opts.darkChroma,
    })
    assertIsDefined(lchDarkest)

    // we define the lightest color of the gradient, with a luminance of maxL and low chroma
    // this color is light and desaturated (tending towards white)
    const lchLightest = clamp({
      ...lchMainColor,
      mode: 'oklch' as const,
      l: opts.maxL,
      c: opts.lightChroma,
    })
    assertIsDefined(lchLightest)

    // our main color is positioned based on mainColorStop, regardless of its luminance
    // culori allows us to create linear gradient between colors, which will be interpolated between 0 and 1
    // from our darkest (0) to our main color (position based on mainColorStop) to our lightest (1)
    // we clamp the main color luminance to ensure it is used in the gradient
    const lchGradient = interpolate(
      [lchDarkest, [lchMainColor, opts.mainColorStop], lchLightest],
      'oklch'
    )

    // from our gradient, and with the color stops defined in LUMINANCE, we create a discrete gradient of colors
    // sample is a util from culori that generates an array of equidistant positions in the gradient
    const sampledColors = samples(LUMINANCE.length).map(lchGradient)
    
    const discreteGradient = sampledColors.map((oklchColor, i) => {
      const color = formatHex(oklchColor)
      assertIsDefined(color)
      const luminance = LUMINANCE[i]!
      return [luminance, color] satisfies [(typeof LUMINANCE)[number], string]
    })

    const oklchPoints = sampledColors.map((oklchColor, i) => {
      const luminance = LUMINANCE[i]!
      return [luminance, { l: oklchColor.l, c: oklchColor.c, h: oklchColor.h }] satisfies [(typeof LUMINANCE)[number], OklchPoint]
    })

    const gradient = Object.fromEntries([
      ...discreteGradient,
      [0, WHITE],
      [1000, BLACK],
    ]) as Gradient

    const allOklchPoints = Object.fromEntries([
      ...oklchPoints,
      [0, { l: 1, c: 0, h: undefined }],
      [1000, { l: 0, c: 0, h: undefined }],
    ]) as Record<1000 | (typeof LUMINANCE)[number] | 0, OklchPoint>

    return {
      gradient,
      oklchPoints: allOklchPoints,
      mainColorOklch: { l: lchMainColor.l, c: lchMainColor.c, h: lchMainColor.h },
    }
  }
