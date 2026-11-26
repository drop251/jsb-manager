# Déploiement JSB Manager et JSB Admin — préproduction V36

## Statut et périmètre
Deux origines HTTPS indépendantes et deux distributions distinctes, un backend commun et une base PostgreSQL dédiée. La V35 historique reste intacte ; aucun transfert automatique de données personnelles. Le code V36 ne constitue pas encore une version métier complète : la sélection des candidats Taïso est raccordée, les générateurs complets, séances, PDF et données privées authentifiés doivent être raccordés et testés. Ne pas utiliser ce document comme autorisation de mise en production.

## Préparer l'hébergement privé
L'opérateur choisit un hébergement compatible avec Node.js 22, PostgreSQL 16, un environnement Python dédié sous Linux pour XLSX, un proxy TLS de confiance et un service d'envoi d'e-mails (si activé). Deux noms d'hôtes distincts sont requis. Ne pas utiliser GitHub Pages ou un hébergement statique pour les interfaces authentifiées. Ne pas exposer directement le listener Node.js, ne pas publier le dépôt ni les fichiers backend.

Base distincte nommée jsb_preprod, sauvegardée et sans données réelles : appliquer les migrations de backend/db/migrations dans leur ordre sur une base neuve. Pour une base existante, tenir un registre de migrations et n'appliquer que les migrations non exécutées après sauvegarde. Ne pas réinitialiser une base existante.

Configurer les valeurs suivantes exclusivement dans le gestionnaire de secrets de l'hébergeur, jamais dans le dépôt, les fichiers de recette ou les messages :
- JSB_ENV=preproduction
- JSB_PUBLIC_ORIGIN et JSB_ADMIN_ORIGIN : origines HTTPS exactes, hôtes distincts.
- DATABASE_URL : connexion TLS selon l'hébergeur, base jsb_preprod.
- JSB_QUOTA_KEY, JSB_DELIVERY_KEY, JSB_MFA_KEY, JSB_GATEWAY_KEY : quatre clés indépendantes, 32 octets chacune, base64url canonique.
- JSB_DELIVERY_KEY_ID et JSB_MFA_KEY_ID : identifiants de versions des clés.
- JSB_PORT : port loopback, 8080 par défaut.
- JSB_XLSX_PYTHON : chemin absolu de l'interpréteur Python dédié (openpyxl==3.1.5, defusedxml==0.7.1) si la recette Excel est souhaitée.

Installer les dépendances serveur dans un environnement contrôlé : Node.js 22, pg@8.16.3, Python et les dépendances XLSX si nécessaires. La publication/restauration est désactivée dans le lanceur de préproduction actuel, même après démarrage. Aucun envoi réel d'e-mail n'est activé par ce lanceur.

La passerelle TLS authentifie les testeurs avant chaque requête, retire tout en-tête entrant x-jsb-gateway-proof et x-jsb-client-ip, injecte la preuve et l'adresse IP vérifiée, préserve le Host exact, limite les tailles et délais et ne journalise pas les corps, cookies, secrets ou codes. Elle doit joindre le listener sur loopback dans un espace réseau de confiance. Restreindre les deux origines aux testeurs ; HTTPS seul ne suffit pas.

## Prévol et démarrage
```sh
node scripts/preflight-preproduction.cjs
node backend/preproduction-server.cjs
```
Le prévol utilise la base dédiée et vérifie le schéma, les clés, la construction et l'intégrité des distributions, puis effectue 23 requêtes locales synthétiques (isolation des hôtes, accès fermé sans passerelle, absence de session, exclusion du backend, désactivation de la publication/restauration). Il ne crée ni compte ni catalogue et n'ouvre aucun port externe. Le résultat readyForPrivatePreview ne vérifie ni DNS, ni certificats TLS externes, ni délivrabilité, ni disponibilité réelle sur iPhone.

Après prévol, initialiser le premier administrateur uniquement via la commande interactive prévue dans backend/README.md. Utiliser exclusivement des comptes synthétiques autorisés. Tester depuis Safari iPhone et Mac les deux URL officielles, la séparation des cookies, la connexion et déconnexion, le refus inter-origines, les interfaces et la reprise de visibilité. Tester les e-mails seulement après configuration distincte du fournisseur. Ne pas activer la publication des catalogues utilisateurs tant que les données et le parcours de production n'ont pas été approuvés.

## Conditions avant bascule en production
- Recettes CI intégrales sur le commit retenu ; prévol et vérification externe sur les deux origines.
- Raccordement des moteurs existants et validation du contrat de fiches, génération et sauvegarde des séances, exports PDF distincts, stockage et isolation des données privées (licenciés, présences, planning, historique personnel).
- Gestion administrative des comptes, documents légaux et supervision ; droits vérifiés côté serveur, aucun accès administratif aux données privées des clubs.
- Sauvegarde/restauration de la base, séparation des clés, procédures de révocation et reprise, migration et conservation des données locales V35.
- Validation pédagogique des catalogues définitifs, notamment restrictions et catégories d'âge. Les fixtures de recette ne sont pas publiables.
- Vérification sur appareils physiques, accessibilité et parcours de récupération, configuration réelle des domaines et de l'hébergement.

Le déploiement privé et la publication de production sont deux opérations différentes. Ne pas fusionner automatiquement la branche V36 ni modifier le site historique pour obtenir des liens de démonstration. La mise en service externe requiert un compte d'hébergement connecté ou une intervention de l'opérateur et des domaines HTTPS effectivement configurés.
