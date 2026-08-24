/** Upper bound on a value before it becomes a pipeline output variable. */
const OUTPUT_VAR_MAX_LENGTH = 1024;

/**
 * An ADO output variable is a real trust boundary: it is emitted as
 * `##vso[task.setvariable variable=x]VALUE` and later steps macro-expand `$(x)`
 * into scripts, so a CR/LF in VALUE forges a second logging command and the raw
 * value lands in a shell. Caps length and requires printable ASCII, matching
 * BasePackerCommandHandler/BaseTerraformCommandHandler's guard of the same name.
 * Returns null -- the caller skips the variable -- when validation fails.
 *
 * Takes `unknown` rather than `string` deliberately: an `as string` cast is
 * erased at run time, so a JSON object or number arriving in a field the caller
 * believed was a string is exactly the case this exists to catch.
 */
export function sanitizeOutputVariableValue(value: unknown): string | null {
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    const text = String(value);
    if (!text || text.length > OUTPUT_VAR_MAX_LENGTH) return null;
    return /^[\x20-\x7E]+$/.test(text) ? text : null;
}
