const { connectToDatabase } = require("../../../../database.js");
const hunters = require("./hunters.json");

const ihcId = "353575133157392385";
connectToDatabase("migration").then(async database => {
	await database.models.Company.findOrCreate({ where: { id: ihcId } })
	for (const id in hunters) {
		const user = await database.models.User.findByPk(id);
		if (!user) {
			await database.models.User.create({ id, isPremium: ["112785244733628416", "106122478715150336"].includes(id) });
		}
		const hunter = await database.models.Hunter.findOne({ where: { userId: id, companyId: ihcId } });
		if (!hunter) {
			await database.models.Hunter.create({ userId: id, companyId: ihcId, xp: hunters[id].xp, isRankEligible: id !== "106122478715150336" });
		}
	}
});
