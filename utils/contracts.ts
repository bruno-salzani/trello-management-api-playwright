import { z } from 'zod';

export const BoardSchema = z.object({
  id: z.string(),
  name: z.string(),
  closed: z.boolean().optional(),
  prefs: z
    .object({
      permissionLevel: z.enum(['private', 'org', 'public']).optional(),
    })
    .optional(),
});

export const ListSchema = z.object({
  id: z.string(),
  idBoard: z.string(),
  closed: z.boolean().optional(),
});

export const CardSchema = z.object({
  id: z.string(),
  idList: z.string(),
});

export type Board = z.infer<typeof BoardSchema>;
export type List = z.infer<typeof ListSchema>;
export type Card = z.infer<typeof CardSchema>;

export function validateBoard(o: unknown): asserts o is Board {
  const res = BoardSchema.safeParse(o);
  if (!res.success)
    throw new Error(`Contrato inválido (Board): ${JSON.stringify(res.error.format())}`);
}

export function validateList(o: unknown): asserts o is List {
  const res = ListSchema.safeParse(o);
  if (!res.success)
    throw new Error(`Contrato inválido (List): ${JSON.stringify(res.error.format())}`);
}

export function validateListClosed(o: unknown): asserts o is List {
  const res = ListSchema.extend({ closed: z.boolean() }).safeParse(o);
  if (!res.success)
    throw new Error(`Contrato inválido (ListClosed): ${JSON.stringify(res.error.format())}`);
}

export function validateCard(o: unknown): asserts o is Card {
  const res = CardSchema.safeParse(o);
  if (!res.success)
    throw new Error(`Contrato inválido (Card): ${JSON.stringify(res.error.format())}`);
}
