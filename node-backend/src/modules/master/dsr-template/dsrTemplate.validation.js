import { z } from 'zod';

const hasTemplateName = (body) => Boolean(body && body.name && String(body.name).trim());

/** POST / - the template name is required. The body passes on unchanged (its other fields are the saved config). */
export const saveTemplateSchema = z.unknown().refine(hasTemplateName, 'Template name is required');

export const dsrTemplateErrorBody = (message) => ({ success: false, message });
