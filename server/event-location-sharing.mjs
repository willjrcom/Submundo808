/**
 * Ativa/desativa a permissão de compartilhamento de um evento.
 * A localização de cada participante continua dependendo do gesto dele no Mapa.
 * Usar dentro da mesma transação da alteração do evento para impedir estados parciais.
 */
export function applyEventLocationSharing(db,eventId,enabled,now=Date.now()){
 db.prepare('UPDATE events SET location_sharing_enabled=? WHERE id=?').run(enabled?1:0,eventId);
 if(enabled)return;
 // Desabilitar deve imediatamente retirar posições e as sessões do evento.
 db.prepare('DELETE FROM live_locations WHERE user_id IN (SELECT user_id FROM location_preferences WHERE share_event_id=?)').run(eventId);
 db.prepare('UPDATE location_preferences SET share_enabled=0,gps_enabled=0,share_with_groups=0,share_expires_at=NULL,share_event_id=NULL,analytics_enabled=0,analytics_event_id=NULL,updated_at=? WHERE share_event_id=?').run(now,eventId);
}
