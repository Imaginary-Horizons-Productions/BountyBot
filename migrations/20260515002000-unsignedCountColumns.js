'use strict';

function unsignedBigInt(Sequelize, options = {}) {
	return { type: Sequelize.BIGINT.UNSIGNED, ...options };
}

function unsignedInteger(Sequelize, options = {}) {
	return { type: Sequelize.INTEGER.UNSIGNED, ...options };
}

function signedBigInt(Sequelize, options = {}) {
	return { type: Sequelize.BIGINT, ...options };
}

function signedInteger(Sequelize, options = {}) {
	return { type: Sequelize.INTEGER, ...options };
}

async function changeColumns(queryInterface, Sequelize, definitions) {
	for (const [table, columns] of Object.entries(definitions)) {
		const tableDescription = await queryInterface.describeTable(table);
		for (const [column, definition] of Object.entries(columns)) {
			if (column in tableDescription) {
				await queryInterface.changeColumn(table, column, definition(Sequelize));
			}
		}
	}
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await changeColumns(queryInterface, Sequelize, {
			Hunter: {
				xp: S => unsignedBigInt(S, { defaultValue: 0 }),
				mineFinished: S => unsignedBigInt(S, { defaultValue: 0 }),
				othersFinished: S => unsignedBigInt(S, { defaultValue: 0 }),
				toastsRaised: S => unsignedBigInt(S, { defaultValue: 0 }),
				toastsSeconded: S => unsignedBigInt(S, { defaultValue: 0 }),
				toastsReceived: S => unsignedBigInt(S, { defaultValue: 0 }),
				goalsInitiated: S => unsignedBigInt(S, { defaultValue: 0 }),
				goalContributions: S => unsignedBigInt(S, { defaultValue: 0 }),
				penaltyCount: S => unsignedBigInt(S, { defaultValue: 0 }),
				penaltyPointTotal: S => unsignedBigInt(S, { defaultValue: 0 })
			},
			Participation: {
				xp: S => unsignedBigInt(S, { defaultValue: 0 }),
				placement: S => unsignedInteger(S, { defaultValue: 0 }),
				rankIndex: S => unsignedInteger(S),
				postingsCompleted: S => unsignedInteger(S, { defaultValue: 0 }),
				toastsRaised: S => unsignedInteger(S, { defaultValue: 0 }),
				goalContributions: S => unsignedInteger(S, { defaultValue: 0 }),
				dqCount: S => unsignedInteger(S, { defaultValue: 0 })
			},
			Season: {
				bountiesCompleted: S => unsignedBigInt(S, { defaultValue: 0 }),
				toastsRaised: S => unsignedBigInt(S, { defaultValue: 0 })
			},
			Goal: {
				requiredGP: S => unsignedBigInt(S, { allowNull: false })
			},
			Bounty: {
				slotNumber: S => unsignedInteger(S, { allowNull: false })
			},
			Completion: {
				xpAwarded: S => unsignedInteger(S)
			}
		});
	},

	async down(queryInterface, Sequelize) {
		await changeColumns(queryInterface, Sequelize, {
			Hunter: {
				xp: S => signedBigInt(S, { defaultValue: 0 }),
				mineFinished: S => signedBigInt(S, { defaultValue: 0 }),
				othersFinished: S => signedBigInt(S, { defaultValue: 0 }),
				toastsRaised: S => signedBigInt(S, { defaultValue: 0 }),
				toastsSeconded: S => signedBigInt(S, { defaultValue: 0 }),
				toastsReceived: S => signedBigInt(S, { defaultValue: 0 }),
				goalsInitiated: S => signedBigInt(S, { defaultValue: 0 }),
				goalContributions: S => signedBigInt(S, { defaultValue: 0 }),
				penaltyCount: S => signedBigInt(S, { defaultValue: 0 }),
				penaltyPointTotal: S => signedBigInt(S, { defaultValue: 0 })
			},
			Participation: {
				xp: S => signedBigInt(S, { defaultValue: 0 }),
				placement: S => signedInteger(S, { defaultValue: 0 }),
				rankIndex: S => signedInteger(S),
				postingsCompleted: S => signedInteger(S, { defaultValue: 0 }),
				toastsRaised: S => signedInteger(S, { defaultValue: 0 }),
				goalContributions: S => signedInteger(S, { defaultValue: 0 }),
				dqCount: S => signedInteger(S, { defaultValue: 0 })
			},
			Season: {
				bountiesCompleted: S => signedBigInt(S, { defaultValue: 0 }),
				toastsRaised: S => signedBigInt(S, { defaultValue: 0 })
			},
			Goal: {
				requiredGP: S => signedBigInt(S, { allowNull: false })
			},
			Bounty: {
				slotNumber: S => signedInteger(S, { allowNull: false })
			},
			Completion: {
				xpAwarded: S => signedInteger(S)
			}
		});
	}
};
