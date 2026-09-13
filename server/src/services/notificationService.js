// Called inside the originating transaction so failed actions never send notifications.
export async function notifyUser(db, userId, title, body, route, icon = "users") {
  await db.query("INSERT INTO notifications(user_id,title,body,route,icon) VALUES ($1,$2,$3,$4,$5)", [userId, title, body, route, icon]);
}
export async function notifyClass(db, classId, title, body, route, icon) {
  await db.query("INSERT INTO notifications(user_id,title,body,route,icon) SELECT student_id,$2,$3,$4,$5 FROM class_memberships WHERE class_id=$1 AND status='ACTIVE'", [classId, title, body, route, icon]);
}
