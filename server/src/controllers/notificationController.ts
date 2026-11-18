// @ts-nocheck
export function createNotificationController(service) {
  return {
    async list(request, response) {
      response.json({ success: true, notifications: await service.list(request.user.userId) });
    },
    async markReadThrough(request, response) {
      await service.markReadThrough(request.user.userId, request.body?.throughId);
      response.json({ success: true });
    },
    async markRead(request, response) {
      await service.markRead(request.user.userId, request.params.id);
      response.json({ success: true });
    },
  };
}

