import { BadRequestException, Injectable, PipeTransform } from "@nestjs/common";
import type { ZodSchema } from "zod";
import { ZodError } from "zod";

@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    try {
      return this.schema.parse(value);
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          message: "Validation failed",
          issues: error.issues
        });
      }
      throw error;
    }
  }
}

