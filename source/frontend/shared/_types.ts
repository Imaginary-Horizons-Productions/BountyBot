import { DatabaseTypes } from "../../database";

export type ConfigCompanyThumbnailsSettings = { label: string; description: string; payloadProperty: keyof DatabaseTypes.Company; }[];
