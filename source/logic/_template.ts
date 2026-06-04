import { Database } from "../database";

/**
 * The baseline structure for logic files.
 */

let db: Database;

/** Set the database pointer for this logic file. */
export function setDB(database: Database) {
	db = database;
}
