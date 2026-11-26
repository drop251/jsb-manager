# Deux applications, un dépôt

- `admin/` : point d'entrée de développement de l'administration.
- `public/` : point d'entrée de développement grand public (coach et particulier).
- `../index.html` : PWA historique locale conservée pour les recettes et la migration ; ne constitue pas une application multi-utilisateur sécurisée.
- `../modules/judo.js`, `../modules/taiso.js`, `../core/`, `../ui/` : briques existantes à mutualiser progressivement, sans duplication.

Les deux points d'entrée sont des prototypes de navigation autonomes V36, sans accès aux données, sans stockage, sans authentification ni inscription réelle. Le choix Coach/Particulier dans le prototype public ne constitue pas une session ni une autorisation. Ils ne redirigent pas vers la PWA historique.
Les déploiements cibles utilisent des origines distinctes et des artefacts construits séparément. L'artefact grand public ne doit contenir ni interface d'administration ni backend ni fichiers privés.
Ne pas publier le dépôt entier comme solution de production. Le service worker historique doit ignorer ces nouvelles routes pour ne pas contaminer ses caches. Les futurs service workers auront des périmètres et caches indépendants.
La migration des données reste à concevoir et à tester ; aucune suppression automatique.

## Recettes et prévisualisations
Le workflow de prévisualisation construit deux artefacts séparés, chacun contenant uniquement son index.html autonome. Les liens des artefacts se trouvent dans la recette GitHub Actions de la PR. Aucun déploiement public ni accès au backend n'est activé. Pour une consultation directe sur iPhone sans téléchargement, il faudra configurer un hébergement de préproduction séparé pour chaque application, sans données réelles. Ne jamais utiliser un hébergeur tiers de HTML brut sans accord.

## Écrans de connexion raccordables (V36)
Les fichiers `public/auth.html` et `admin/auth.html` disposent de contrôleurs distincts `auth-page.mjs` et du transport mutualisé `shared/auth-client.mjs`. Ils sont distincts des prototypes autonomes index.html, qui restent inchangés. Ne pas inclure les écrans de connexion dans les artefacts de démonstration. Dans chaque futur artefact déployable, copier uniquement le dossier de l'application concernée et le module partagé, en conservant le chemin relatif du module. Ne jamais servir le dossier de l'autre application, le backend ou le dépôt entier.

Les champs sont désactivés tant que la page n'est pas servie en HTTPS, que Web Locks n'est pas disponible ou que l'API de session n'a pas répondu avec un état valide. Les mots de passe et codes MFA ne sont pas persistés ; le cookie sécurisé reste géré par le serveur. Le client confirme la nouvelle identité auprès de /api/session et sérialise connexion/déconnexion entre onglets coopérants avec Web Locks. Une erreur de transport verrouille l'accès. La reprise de visibilité déclenche une relecture de session. Cela ne constitue pas encore un mécanisme complet d'isolation des données métier ou de révocation concurrente côté serveur.
Aucun accès métier, inscription depuis le nouvel écran, hébergement HTTPS ou envoi d'e-mail n'est activé par ces fichiers. Les formulaires ne doivent être utilisés avec des identifiants réels qu'après mise en service et recette sur les origines officielles. Recette navigateur HTTPS et intégration complète requises avant publication.

## Construction des distributions d'authentification de préproduction
`node scripts/build-auth-preview.cjs public /chemin/vers/dossier-public-neuf` et la même commande avec `admin` produisent chacune trois fichiers applicatifs et un manifeste SHA-256. Le répertoire de destination doit être inexistant. Les fichiers de démonstration, la PWA historique, le backend, les migrations, les données et l'autre application sont exclus. Le point d'entrée est respectivement `/public/auth.html` ou `/admin/auth.html`. Le manifeste est un inventaire de construction, pas un mécanisme d'autorisation.

La recette PostgreSQL produit les deux archives de préproduction uniquement après les recettes HTTPS et le contrôle de séparation. Elles ne constituent pas des PWA complètes ni un déploiement. Ne servir que les trois fichiers autorisés par application sur son hôte HTTPS et acheminer /api vers son handler serveur. L'accès de préproduction doit être restreint et la base indépendante de la production, sans données réelles. La configuration de l'hébergement et du proxy demeure à effectuer. Ne pas mettre en service des formulaires de connexion sur un hébergement tiers non contrôlé.
