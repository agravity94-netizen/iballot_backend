"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("./config/database"));
async function test() {
    try {
        const list = await database_1.default.constituency.findMany({
            include: {
                city: {
                    include: { province: true }
                }
            }
        });
        console.log("Total constituencies: ", list.length);
        console.log("First constituency: ", JSON.stringify(list[0], null, 2));
        const lahoreList = await database_1.default.constituency.findMany({
            where: {
                city: {
                    name: "Lahore"
                }
            },
            include: {
                city: true
            }
        });
        console.log("Lahore constituencies: ", lahoreList.length);
    }
    catch (err) {
        console.error("Error running test: ", err);
    }
    finally {
        await database_1.default.$disconnect();
    }
}
test();
