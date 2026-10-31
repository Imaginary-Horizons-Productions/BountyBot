import { DatabaseTypes } from "../../database/index.ts";

export type ConfigCompanyThumbnailsSettings = { label: string; description: string; payloadProperty: keyof DatabaseTypes.Company; }[];
