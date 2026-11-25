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
