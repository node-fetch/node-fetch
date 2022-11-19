import fs from 'fs'

// Schemas to parse and validate all external inputs
// Catch user input errors before the payment starts!
// -> CSV input/output
// -> Prompt input (answers to questions)
import { XrplNetwork, XrpUtils } from 'xpring-js'
import * as z from 'zod'

import log, { black } from './log'

/**
 * Validate objects in an array against a schema and bind
 * the type from the schema to the validated data.
 *
 * @param objects - The array of objects to validate.
 * @param schema - The schema to validate the objects array.
 *
 * @returns Array of validated, typed objects.
 * @throws Error if validation fails.
 */
export function validateObjects<T>(
  objects: unknown[],
  schema: z.Schema<T>,
): T[] {
  // Validate parsed output against a schema and bind types
  // to the validated output
  const validatedResult: T[] = []
  objects.forEach((account: unknown, index: number) => {
    validatedResult.push(schema.parse(account))
    log.debug(
      black(
        `  -> Validated entry ${index + 1} / ${
          objects.length
        }: ${JSON.stringify(validatedResult[index])}`,
      ),
    )
  })

  return validatedResult
}

// Object schema for the receiver inputs (rows from the input CSV)
export const txInputSchema = z.object({
  address: z
    .string()
    .nonempty()
    .refine((val) => XrpUtils.isValidClassicAddress(val), {
      message: '`address` must be a valid XRPL classic address.',
    }),
  destinationTag: z.union([z.number().nonnegative().int(), z.null()]),
  usdAmount: z.number().positive(),
  name: z.string().nonempty(),
})
export type TxInput = z.infer<typeof txInputSchema>

// Object schema for the receiver outputs (rows in the output CSV)
export const txOutputSchema = txInputSchema.extend({
  transactionHash: z.string().nonempty(),
  usdToXrpRate: z.number().positive(),
})
export type TxOutput = z.infer<typeof txOutputSchema>

// Object schema for the payer inputs (payer answers or overrides to prompt questions)
export const senderInputSchema = z.object({
  inputCsv: z
    .string()
    .nonempty()
    // eslint-disable-next-line node/no-sync -- Synchronous call works here.
    .refine((val) => fs.existsSync(val), {
      message: `Input CSV does not exist.`,
    }),
  outputCsv: z
    .string()
    .nonempty()
    // eslint-disable-next-line node/no-sync -- Synchronous call works here.
    .refine((val) => !fs.existsSync(val), {
      message: `Output CSV already exists.`,
    }),
  network: z.nativeEnum(XrplNetwork),
  grpcUrl: z.string().url(),
  maxFee: z.number().positive(),
  usdToXrpRate: z.number().positive(),
  secret: z.string().nonempty(),
  confirmed: z.boolean(),
})
export type SenderInput = z.infer<typeof senderInputSchema>
