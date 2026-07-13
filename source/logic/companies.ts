import { Interaction } from "discord.js";
import { Database } from "../database";
import { InteractionTheater } from "../frontend/classes";

let db: Database;

/** *Sets the database pointer for the Company logic file* */
export function setDB(database: Database) {
	db = database;
}

export async function constructInteractionTheater(interaction: Interaction): Promise<InteractionTheater> {
	return {
		company: (await db.Companies.findOrCreate({ where: { id: interaction.guildId } }))[0],
		user: (await db.Users.findOrCreate({ where: { id: interaction.user.id } }))[0],
		hunter: (await db.Hunters.findOrCreate({ where: { userId: interaction.user.id, companyId: interaction.guildId } }))[0]
	};
}

/** *Queries for a Company* */
export function findOrCreateCompany(companyId: string) {
	return db.Companies.findOrCreate({ where: { id: companyId } });
}

/** *Queries for a Company by primary key* */
export function findCompanyByPK(companyId: string) {
	return db.Companies.findByPk(companyId);
}

/** *Reset the specified Company's settings to the defaults* */
export function resetCompanySettings(id: string) {
	db.Companies.update(
		{
			announcementPrefix: "@here",
			maxSimBounties: 5,
			backupTimer: 3600000,
			xpFestivalMultiplier: 1,
			gpFestivalMultiplier: 1,
			xpCoefficient: 3,
			toastThumbnailURL: null,
			openBountyThumbnailURL: null,
			completedBountyThumbnailURL: null,
			deletedBountyThumbnailURL: null,
			scoreboardThumbnailURL: null,
			goalCompletionThumbnailURL: null,
			raffleThumbnailURL: null
		},
		{ where: { id } }
	);
}

/** *Deletes the specified Company* */
export function deleteCompany(companyId: string) {
	return db.Companies.destroy({ where: { id: companyId } });
}
