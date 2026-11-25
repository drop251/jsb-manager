# Backend commun — à implémenter

Le backend n'est pas encore opérationnel. La politique de permissions pure se trouve dans `core/platform-permissions.cjs`.
L'identité, le statut et les appartenances doivent être résolus à partir d'une session vérifiée côté serveur. Les périmètres des ressources doivent être déterminés par le stockage serveur, jamais acceptés comme preuve depuis le client.

Services cibles : authentification, comptes, catalogue, statistiques agrégées, documents légaux, données privées par propriétaire/club.
Les interfaces ne doivent jamais recevoir de données hors de leurs autorisations. Aucun accès administrateur aux données privées des clubs.
Aucun secret, compte fictif actif ou endpoint simulé n'est fourni.
