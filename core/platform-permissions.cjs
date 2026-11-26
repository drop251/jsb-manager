'use strict';
// Politique pure : les identités et appartenances doivent être établies par le serveur.
// Ne jamais utiliser les valeurs fournies directement par un client comme identité fiable.
const RULES = Object.freeze({
  admin: Object.freeze({
    catalogue: ['read','write','import','delete'], generatorTest: ['run'],
    platformAccounts: ['read','suspend','reactivate'], aggregateStats: ['read'],
    legal: ['read','draft','publish']
  }),
  coach: Object.freeze({ catalogue:['read'], legal:['read'], legalAcceptance:['read','write'],
    clubMembers:['read','write','delete'], attendance:['read','write','delete'],
    clubReports:['read'], clubPlanning:['read','write','delete'],
    privateSessions:['read','write','delete'], privateBackups:['read','write','delete'], generator:['run'] }),
  individual: Object.freeze({ catalogue:['read'], legal:['read'], legalAcceptance:['read','write'],
    privateSessions:['read','write','delete'], privateBackups:['read','write','delete'], generator:['run'] })
});
const CLUB = new Set(['clubMembers','attendance','clubReports','clubPlanning']);
const PRIVATE = new Set(['privateSessions','privateBackups','legalAcceptance','generator']);
function idValid(id) { return typeof id === 'string' && id.trim().length > 0; }
function authorize(actor, resource, action, scope) {
  if (!actor || actor.authenticated !== true || actor.status !== 'active' || !idValid(actor.id)) return false;
  if (!Object.hasOwn(RULES,actor.role)) return false;
  const rules = RULES[actor.role];
  if (!Object.hasOwn(rules,resource) || !rules[resource].includes(action)) return false;
  if (CLUB.has(resource)) return actor.role === 'coach' && !!scope && idValid(scope.clubId) &&
    Array.isArray(actor.clubIds) && actor.clubIds.includes(scope.clubId);
  if (PRIVATE.has(resource)) return !!scope && idValid(scope.ownerId) && scope.ownerId === actor.id;
  return true;
}
module.exports = Object.freeze({authorize});
