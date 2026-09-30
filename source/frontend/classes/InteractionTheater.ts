import type { DatabaseTypes } from "../../database";

export interface InteractionTheater {
	company: DatabaseTypes.Company;
	user: DatabaseTypes.User;
	hunter: DatabaseTypes.Hunter;
}
