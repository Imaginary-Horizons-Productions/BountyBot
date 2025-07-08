'use strict';
const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable("UserInteraction", {
			userId: {
				primaryKey: true,
				type: DataTypes.STRING,
				allowNull: false,
				references: {
					model: 'User',
					key: 'id'
				}
			},
			interactionName: {
				primaryKey: true,
				type: DataTypes.STRING,
				allowNull: false
			},
			interactionTime: {
				type: DataTypes.DATE
			},
			lastInteractTime: {
				type: DataTypes.DATE
			},
			cooldownTime: {
				type: DataTypes.DATE
			}
		}, {
			sequelize: queryInterface.sequelize,
			modelName: "UserInteraction",
			freezeTableName: true,
			timestamps: false
		});
	},
	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable('UserInteraction');
	}
};
