TRUNCATE TABLE security."UserNotification" RESTART IDENTITY;
SELECT count(*) AS notifications FROM security."UserNotification";
