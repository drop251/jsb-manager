# Interface — première consolidation visuelle

Périmètre : CSS et hiérarchie visuelle uniquement. Aucun changement de logique métier, navigation, données, stockage, générateur ou import/export. La feuille locale est chargée en dernier pour maîtriser la cascade et précachée dans la PWA.

Décisions : conserver l'identité graphique actuelle, la capsule et le retour tactile ; éviter les grands titres redondants avec la barre de section (titre sémantique conservé), compacter les raccourcis de l'accueil, homogénéiser les libellés de navigation à 12 px de base, préserver les cibles tactiles et les préférences de texte agrandi/réduction des mouvements.

Recette requise avant publication : captures comparatives accueil et sections, iPhone portrait/paysage, desktop, thèmes clair/sombre, texte agrandi, navigation et focus. Ce lot ne prétend pas résoudre les préférences visuelles non encore exprimées. CI + accord sur le rendu avant fusion.

## V2 — écrans internes et recette visuelle

- Barre de section adaptée aux surfaces clair/sombre, sans liseré décoratif ; marque et destinations inchangées.
- Harmonisation des surfaces, cartes, boutons, champs, titres, réglages, générateur, préparation et historique ; aucune action retirée.
- CSS uniquement, pas de modification des composants React ni des données. Cibles tactiles de 44 px minimum sur les contrôles visés ; champs à 16 px minimum ; retour tactile et préférence de texte agrandi conservés.
- Nouveau workflow indépendant de la recette PWA : WebKit iPhone émulé et Chromium desktop, captures PNG dans les deux thèmes, navigation, générateur et réglages, vérifications géométriques des onglets et de la lisibilité du thème. Aucun stockage utilisateur réel. Le service worker est bloqué pour isoler la recette visuelle ; la recette hors ligne reste distincte.
- Les captures et résultats doivent être examinés avant fusion. Aucune prétention de conformité WCAG ou de validation physique Safari.
