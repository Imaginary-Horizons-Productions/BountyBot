'use strict';
const { DataTypes } = require('sequelize');

class OldItemStructure {
	userId;
	itemName;
	count;
	createdAt;
	updatedAt;

	/**
	 * Make a skeleton of the old item structure. This can either be made out of a NewItemStructure,
	 * or out of an object that has the prerequisite properties.
	 * @param {NewItemStructure | {userId, itemName, count, createdAt, updatedAt}} objWithProperties
	 */
	constructor(objWithProperties) {
		if (objWithProperties instanceof NewItemStructure) {
			this.userId = objWithProperties.userId;
			this.itemName = objWithProperties.itemName;
			this.count = 1;
			this.createdAt = new Date(objWithProperties.createdAt);
			this.updatedAt = new Date(objWithProperties.updatedAt);
		} else {
			this.userId = objWithProperties.userId;
			this.itemName = objWithProperties.itemName;
			this.count = objWithProperties.count;
			this.createdAt = new Date(objWithProperties.createdAt);
			this.updatedAt = new Date(objWithProperties.updatedAt);
		}
	}

	/**
	 * Add to the number of items being tracked by this instance
	 */
	incrementCount() {
		this.count++;
	}

	/**
	 * Update date information.
	 * `createdAt` is the least recent item date.
	 * `updatedAt` is the most recent item date.
	 * @param {*} date
	 */
	updateDateInformation(date) {
		let realDate = new Date(date);
		this.createdAt = realDate < this.createdAt ? realDate : this.createdAt;
		this.updatedAt = realDate > this.updatedAt ? realDate : this.updatedAt;
	}

	/**
	 * Return this object as a vanilla object for Sequelize compatibility
	 * @returns {}
	 */
	asQueryCompatible() {
		return {
			userId: this.userId,
			itemName: this.itemName,
			count: this.count,
			createdAt: this.createdAt,
			updatedAt: this.updatedAt
		};
	}
}

class NewItemStructure {
	/** @type {string} */
	userId;
	/** @type {string} */
	itemName;
	/** @type {boolean} */
	used;
	/** @type {Date} */
	createdAt;
	/** @type {null} in the actual db, this will be `Date | null`, but we're not migrating any used items */
	updatedAt;

	/**
	 * Make a new NewItemStructure based on the passed object.
	 * The only requirement is that the passed object has the prerequisite properties.
	 * @param {{ userId: string, itemName: string, createdAt: Date}} objWithProperties
	 */
	constructor(objWithProperties) {
		this.userId = objWithProperties.userId;
		this.itemName = objWithProperties.itemName;
		this.used = false;
		this.createdAt = objWithProperties.createdAt;
		this.updatedAt = null;
	}
}

/**
 * Convert new items back to old items
 * @param {NewItemStructure} items
 * @returns {OldItemStructure}
 */
function newToOldItems(items) {
	let oldItemsAsMap = new Map();
	for (let item of items) {
		if (item.used) continue; // Skip and do not count used items. Used items are not tracked in the old structure

		if (!oldItemsAsMap.has(item.userId)) oldItemsAsMap.set(item.userId, new Map());

		let itemsForUser = oldItemsAsMap.get(item.userId, new Map());
		if (!itemsForUser.has(item.itemName)) {
			itemsForUser.set(item.itemName, new OldItemStructure(item));
		} else {
			let thisItem = itemsForUser.get(item.itemName)
			thisItem.incrementCount();
			thisItem.updateDateInformation(item.createdAt);
		}
	}
	return [...oldItemsAsMap.values()].map(map => [...map.values()]).flat();
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		let [oldItems] = await queryInterface.sequelize.query("SELECT * FROM Item");
		/** @type {NewItemStructure[]} */
		const migratedItems = [];
		for (const item of oldItems.map(raw => new OldItemStructure(raw))) {
			for (let i = 0; i < item.count; i++) {
				migratedItems.push(new NewItemStructure(item));
			}
		}
		await queryInterface.dropTable("Item");
		await queryInterface.createTable("Item", {
			id: {
				primaryKey: true,
				type: DataTypes.INTEGER,
				autoIncrement: true
			},
			userId: {
				type: DataTypes.STRING,
				allowNull: false,
				references: {
					model: 'User',
					key: 'id'
				}
			},
			itemName: {
				type: DataTypes.STRING,
				allowNull: false
			},
			used: {
				type: DataTypes.BOOLEAN,
				default: false
			},
			createdAt: {
				type: DataTypes.DATE,
				default: DataTypes.NOW
			},
			updatedAt: {
				type: DataTypes.DATE
			}
		}, {
			sequelize: queryInterface.sequelize,
			modelName: "Item",
			freezeTableName: true
		});
		if (oldItems.length > 0) {
			await queryInterface.bulkInsert("Item", migratedItems);
		}
	},

	async down(queryInterface, Sequelize) {
		let [newItems] = await queryInterface.sequelize.query("SELECT * FROM Item");
		let oldItems = newToOldItems(newItems.map(raw => new NewItemStructure(raw)));
		await queryInterface.dropTable("Item");
		await queryInterface.createTable("Item", {
			userId: {
				primaryKey: true,
				type: DataTypes.STRING,
				allowNull: false,
				references: {
					model: 'User',
					key: 'id'
				}
			},
			itemName: {
				primaryKey: true,
				type: DataTypes.STRING,
				allowNull: false
			},
			count: {
				type: DataTypes.BIGINT,
				defaultValue: 1
			},
			createdAt: {
				type: DataTypes.DATE,
				default: DataTypes.NOW
			},
			updatedAt: {
				type: DataTypes.DATE,
				default: DataTypes.NOW
			}
		}, {
			sequelize: queryInterface.sequelize,
			modelName: "Item",
			freezeTableName: true
		});
		if (oldItems.length > 0) {
			await queryInterface.bulkInsert("Item", oldItems.map(i => i.asQueryCompatible()));
		}
	}
};
