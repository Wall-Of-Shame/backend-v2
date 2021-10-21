-- Fix selection bug, should only show if results have been released

DROP VIEW IF EXISTS "UserWithMetaData";

CREATE VIEW "UserWithMetaData" AS
WITH
"T1" AS (
    SELECT    *
    FROM      "Participant" p
    LEFT JOIN "Challenge" c
    ON        p."challengeId" = c."challengeId"
    WHERE     c."endAt" <= NOW()::TIMESTAMP
    AND       p."joined_at" IS NOT NULL
    AND       c."result_released_at" IS NOT NULL
),
"UserCount" AS (
    SELECT *,
        (
                SELECT COUNT(*)
                FROM   "T1" t1
                WHERE  t1."userId" = u."userId"
                AND    t1."completed_at" IS NULL ) AS "failedCount",
        (
                SELECT COUNT(*)
                FROM   "T1" t1
                WHERE  t1."userId" = u."userId"
                AND    t1."completed_at" IS NOT NULL
                AND    NOT t1."has_been_vetoed" ) AS "completedCount",
        (
                SELECT COUNT(*)
                FROM   "T1" t1
                WHERE  t1."userId" = u."userId"
                AND    t1."completed_at" IS NOT NULL
                AND    t1."has_been_vetoed" ) AS "vetoedCount"
    FROM    "User" u
)
SELECT *, 
    u."failedCount" + u."vetoedCount" AS "totalFailedCount"
FROM "UserCount" u
ORDER BY "totalFailedCount" DESC, u."username" ASC;

