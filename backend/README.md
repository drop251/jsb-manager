# Backend commun — développement

Le backend n'est pas encore opérationnel. La politique de permissions pure se trouve dans `core/platform-permissions.cjs`.
L'identité, le statut et les appartenances doivent être résolus à partir d'une session vérifiée côté serveur. Les périmètres des ressources doivent être déterminés par le stockage serveur, jamais acceptés comme preuve depuis le client.

Services cibles : authentification, comptes, catalogue, statistiques agrégées, documents légaux, données privées par propriétaire/club.
Les interfaces ne doivent jamais recevoir de données hors de leurs autorisations. Aucun accès administrateur aux données privées des clubs.
Aucun secret, compte fictif actif ou endpoint simulé n'est fourni.

## Adaptateur HTTP d'authentification
`auth-http.cjs` expose un handler Node.js pour une origine HTTPS et un périmètre (`public` ou `admin`) configurés côté serveur. Construire chaque instance avec `createPublicLoginService` ou `createAdminLoginService` respectivement, les sessions persistantes et les services nécessaires. Le handler refuse les origines étrangères pour les mutations, n'active pas CORS, vérifie le rôle de la session à chaque lecture, limite les corps JSON à 8 Kio et ne retourne pas le jeton au JavaScript. Cookies distincts `__Host-jsb-public` / `__Host-jsb-admin`, Secure, HttpOnly, SameSite=Strict, Path=/, sans Domain. Les réponses API ne doivent être mises en cache ni par le navigateur ni par un service worker.

Routes communes : GET /api/session, POST /api/login, POST /api/logout. Routes publiques seulement : POST /api/register, /api/verify-email, /api/resend-verification, /api/password-reset/request, /api/password-reset/confirm. Les jetons d'action sont transmis dans le corps JSON, jamais en paramètre de l'API. La connexion réussie remplace la session du compte précédent de l'appareil ; la connexion refusée ne la révoque pas. Les interfaces doivent sérialiser les changements de compte, verrouiller les écritures et les autres onglets durant la transition, et traiter les réponses tardives. Les courses entre requêtes simultanées de changement de compte restent à traiter avant publication.

Le handler ne constitue pas un serveur déployable complet. Restent : composition réelle des services PostgreSQL, MFA persistante, configuration des origines et du proxy TLS, résolution fiable de l'adresse source (ne jamais accepter X-Forwarded-For sans proxy de confiance), limites de connexion et délais au niveau serveur/proxy, expédition des e-mails, contrôle des caches, recette réseau et navigateur avec HTTPS. Les autres ressources métier restent à exposer via des routes autorisées. Aucune de ces routes n'est publiée à ce stade.

## Service de préproduction
`preproduction-http.cjs` charge une distribution construite par `scripts/build-auth-preview.cjs`, vérifie le manifeste et l'intégrité des trois fichiers, puis ne sert que ces ressources et le handler /api correspondant. Un hôte incorrect, une requête hors liste ou un accès non autorisé est refusé. La racine redirige vers le formulaire de connexion. Toutes les ressources statiques sont non mises en cache, avec CSP stricte et interdiction d'intégration dans une iframe.

Le contrôle d'accès `authorizeAccess(req)` est obligatoire et doit être alimenté par une passerelle de préproduction de confiance, pour les fichiers **et** l'API. Aucun adaptateur permissif par défaut. La vérification du manifeste ne remplace pas la confiance dans le pipeline de construction. Le module ne démarre aucun listener et ne configure ni TLS, ni DNS, ni PostgreSQL hébergé, ni gestionnaire de secrets. Avant déploiement, il faut choisir un hébergeur, isoler la base et les clés de préproduction, configurer deux hôtes distincts, limiter les accès aux testeurs et valider la recette HTTPS. Ne pas connecter les données de la V35.
