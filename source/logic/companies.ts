import { Interaction } from "discord.js";
import { Sequelize } from "sequelize";
import { InteractionOrigin } from "../frontend/classes";

let db: Sequelize;

/** *Sets the database pointer for the Company logic file* */
export function setDB(database: Sequelize) {
	db = database;
}

export async function getInteractionOrigin(interaction: Interaction): Promise<InteractionOrigin> {
	return {
		company: (await db.models.Company.findOrCreate({ where: { id: interaction.guildId } }))[0],
		user: (await db.models.User.findOrCreate({ where: { id: interaction.user.id } }))[0],
		hunter: (await db.models.Hunter.findOrCreate({ where: { userId: interaction.user.id, companyId: interaction.guildId } }))[0]
	};
}

/** *Queries for a Company* */
export function findOrCreateCompany(companyId: string) {
	return db.models.Company.findOrCreate({ where: { id: companyId } });
}

/** *Queries for a Company by primary key* */
export function findCompanyByPK(companyId: string) {
	return db.models.Company.findByPk(companyId);
}

/** *Reset the specified Company's settings to the defaults* */
export function resetCompanySettings(id: string) {
	db.models.Company.update(
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
	return db.models.Company.destroy({ where: { id: companyId } });
}
