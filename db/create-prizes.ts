import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL || "mysql://BBLUryZLBYcxPUV.root:WTh3BDL3q75HCHiSoq9eGgGOT1Qkk9JZ@ep-t4ni387b5e83b7519dc8.epsrv-t4n281l4mrmemi4zls9a.ap-southeast-1.privatelink.aliyuncs.com:4000/19a9984d-b412-8523-8000-09c71b8b59cc";

async function createPrizesTable() {
  // Create raw connection
  const pool = mysql.createPool(DATABASE_URL);

  // Create table with raw SQL
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS prizes (
      id bigint unsigned NOT NULL AUTO_INCREMENT,
      play_type ENUM('directo','pale','tripleta','cuatrena','terna') NOT NULL,
      first_prize_multiplier DECIMAL(10,2) DEFAULT '50.00',
      second_prize_multiplier DECIMAL(10,2) DEFAULT '15.00',
      third_prize_multiplier DECIMAL(10,2) DEFAULT '10.00',
      pale_first_second DECIMAL(10,2) DEFAULT '25.00',
      pale_first_third DECIMAL(10,2) DEFAULT '0.00',
      pale_second_third DECIMAL(10,2) DEFAULT '0.00',
      fixed_multiplier DECIMAL(12,2) DEFAULT '0.00',
      description VARCHAR(255),
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log("Prizes table created or already exists");

  // Seed default values using drizzle
  const db = drizzle(pool, { mode: "planetscale", schema });

  // Check if already seeded
  const existing = await db.select().from(schema.prizes);
  if (existing.length === 0) {
    await db.insert(schema.prizes).values([
      {
        playType: "directo",
        firstPrizeMultiplier: "50.00",
        secondPrizeMultiplier: "15.00",
        thirdPrizeMultiplier: "10.00",
        paleFirstSecondMultiplier: "0.00",
        paleFirstThirdMultiplier: "0.00",
        paleSecondThirdMultiplier: "0.00",
        fixedMultiplier: "0.00",
        description: "1er premio=50x, 2do=15x, 3ro=10x por euro",
      },
      {
        playType: "pale",
        firstPrizeMultiplier: "0.00",
        secondPrizeMultiplier: "0.00",
        thirdPrizeMultiplier: "0.00",
        paleFirstSecondMultiplier: "25.00",
        paleFirstThirdMultiplier: "20.00",
        paleSecondThirdMultiplier: "15.00",
        fixedMultiplier: "0.00",
        description: "1er+2do=25x, 1er+3ro=20x, 2do+3ro=15x por euro",
      },
      {
        playType: "terna",
        firstPrizeMultiplier: "0.00",
        secondPrizeMultiplier: "0.00",
        thirdPrizeMultiplier: "0.00",
        paleFirstSecondMultiplier: "0.00",
        paleFirstThirdMultiplier: "0.00",
        paleSecondThirdMultiplier: "0.00",
        fixedMultiplier: "500.00",
        description: "3 cifras = 500x por euro",
      },
      {
        playType: "cuatrena",
        firstPrizeMultiplier: "0.00",
        secondPrizeMultiplier: "0.00",
        thirdPrizeMultiplier: "0.00",
        paleFirstSecondMultiplier: "0.00",
        paleFirstThirdMultiplier: "0.00",
        paleSecondThirdMultiplier: "0.00",
        fixedMultiplier: "4000.00",
        description: "4 cifras = 4,000x por euro",
      },
      {
        playType: "tripleta",
        firstPrizeMultiplier: "0.00",
        secondPrizeMultiplier: "0.00",
        thirdPrizeMultiplier: "0.00",
        paleFirstSecondMultiplier: "0.00",
        paleFirstThirdMultiplier: "0.00",
        paleSecondThirdMultiplier: "0.00",
        fixedMultiplier: "10000.00",
        description: "Tripleta = 10,000x por euro",
      },
    ]);
    console.log("Default prizes seeded successfully");
  } else {
    console.log("Prizes already seeded, skipping");
  }

  await pool.end();
  process.exit(0);
}

createPrizesTable().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
