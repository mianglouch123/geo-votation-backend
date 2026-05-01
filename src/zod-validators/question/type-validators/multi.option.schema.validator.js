import { z } from "zod";

export const MultiOptionConfigSchema = z.object({
  options: z
    .array(
      z.object({
        id: z.string(),
        label: z.string().min(1),
        isChecked: z.boolean().default(false)
      })
    )
    .min(1, "Debe haber al menos una opción"),

  allowMultiple: z.boolean().default(false),

}).strict().superRefine((data, ctx) => {
  // Si NO permite múltiples opciones
  if (!data.allowMultiple) {
    // Contar cuántas opciones están checked = true
    const checkedCount = data.options.filter(opt => opt.isChecked).length;
    
    // No puede haber más de 1 opción seleccionada
    if (checkedCount > 1) {
      ctx.addIssue({
        maximum: 1,
        type: "array",
        inclusive: true,
        message: "Cuando allowMultiple es false, solo puede haber UNA opción seleccionada (isChecked = true)"
      });
    }
  }
  
  // Validación adicional: Si allowMultiple = true, puede haber varias checked
  // (eso está bien, no necesitamos validar)
});