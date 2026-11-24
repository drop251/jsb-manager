# Architecture des fichiers — 24 novembre 2026

Extraction sans changement de version des quatre bibliothèques JavaScript déjà intégrées dans index.html : React, React DOM, SheetJS, jsPDF. Les scripts classiques restent synchrones, locaux et dans le même ordre. Le script applicatif, les styles, les données intégrées et le gabarit PDF restent inchangés.

- index.html : 2 383 196 → 994 519 octets UTF-8.
- Les quatre bibliothèques sont pré-cachées par le service worker versionné.
- Aucun CDN, aucun nouveau téléchargement de dépendance, aucune modification métier.
- Le poids total de la distribution n'est pas réduit par cette seule extraction.
- Tests : budget HTML, ordre de chargement, syntaxe des bibliothèques, présence hors ligne et préservation des blocs de données.
- Avant publication : CI verte et revue du diff ; vérifier en navigateur et PWA la première ouverture en ligne, l'actualisation depuis une ancienne version, puis la réouverture hors ligne, ainsi que les fonctions Excel et PDF. La CI ne remplace pas cette recette réelle.

Pour les anciens fichiers de plus de 1 Mo, utiliser la récupération du blob Git avec son SHA plutôt que l'API Contents.
