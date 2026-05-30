import { Snowflake } from "discord.js";

export class PremiumDictionary {
	declare paid: Snowflake[];
	declare gift: Snowflake[];

	constructor(importedFile: { paid: string[]; gift: string[]; }) {
		this.paid = importedFile.paid || [];
		this.gift = importedFile.gift || [];
	}
}
