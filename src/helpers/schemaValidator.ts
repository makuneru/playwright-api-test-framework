import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

export class SchemaValidator {
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);
  }

  /**
   * Compile a JSON schema for validation
   */
  compile(schema: object): ValidateFunction {
    return this.ajv.compile(schema);
  }

  /**
   * Validate data against a schema
   */
  validate(schema: object, data: any): { valid: boolean; errors: string[] } {
    const validate = this.compile(schema);
    const valid = validate(data);

    if (!valid && validate.errors) {
      const errors = validate.errors.map(
        (error) =>
          `${error.instancePath || 'root'} ${error.message} (${JSON.stringify(error.params)})`
      );
      return { valid: false, errors };
    }

    return { valid: true, errors: [] };
  }

  /**
   * Get validation errors in a formatted string
   */
  getErrorsText(errors: string[]): string {
    return errors.join('\n');
  }

  /**
   * Validate data against a schema and throw error if validation fails
   * This method combines validation and assertion for cleaner test code
   * 
   * @param schema - JSON schema to validate against
   * @param data - Response Data to validate
   * @throws Error if validation fails with detailed error messages
   * 
   * @example
   * ```typescript
   * schemaValidator.validateAndAssert(schema, response.data);
   * ```
   */
  validateAndAssert(schema: object, data: any): void {
    const validation = this.validate(schema, data);
    if (!validation.valid) {
      throw new Error(
        `Response does not match expected schema:\n${this.getErrorsText(validation.errors)}`
      );
    }
  }
}

