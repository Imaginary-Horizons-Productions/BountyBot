const { connectToDatabase } = require("../../../../database.js");

connectToDatabase("migration").then(database => {
	database.models.Item.findAll().then(async itemRows => {
		for (const row of itemRows) {
			if (row.itemName === "Light Green Profile Colorizer") {
				const [destinationRow, wasCreated] = await database.models.Item.findOrCreate({ where: { userId: row.userId, itemName: "Light Grey Profile Colorizer" } });
				destinationRow.increment("count", { by: wasCreated ? row.count - 1 : row.count });
				row.destroy();
			}
		}
	})
});
