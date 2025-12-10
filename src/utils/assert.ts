/**
 * This function allows to assert that a value is defined.
 *
 * It prevents to use the "!" operator which is not type safe.
 */
export function assertIsDefined<T>(
    val: T,
    msg?: string
  ): asserts val is NonNullable<T> {
    if (val === undefined || val === null) {
      throw new TypeError(
        msg ?? `Expected 'val' to be defined, but received ${val}`
      )
    }
  }
  
  /**
   * This function throws an error at compile-time if a value is passed to it.
   *
   * This is useful as a DX tool to verify to ensure, for instance, that a
   * switch statement is exhaustive.
   */
  export function assertIsNever(_val: never, msg?: string): never {
    throw new TypeError(msg ?? `Unexpected value: ${_val}`)
  }
  
  export function isDefined<T>(val: T): val is NonNullable<T> {
    return val !== undefined && val !== null
  }
  