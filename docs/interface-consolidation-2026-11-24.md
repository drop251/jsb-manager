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

## V3 — adaptation aux dimensions réelles

V2 : run de fiabilité 45420816119 réussi ; run visuel 45420816425 réussi (WebKit et Chromium, clair/sombre). Captures générées, consultation visuelle humaine non encore effectuée. Onglets de 48 px de hauteur et texte 12 px vérifiés par les deux moteurs.

V3 : espace de travail desktop étendu jusqu'à 1360 px, préparation jusqu'à 1240 px, générateur centré jusqu'à 740 px, fenêtres bornées à la hauteur utile. Adaptation de la navigation aux petits écrans et au paysage. Le code React est inchangé ; seuls CSS, cache, tests et documentation sont modifiés. La recette vérifie désormais géométrie, absence de défilement horizontal et libellés non tronqués à 320 px, tablette, paysage iPhone et grand écran (six configurations moteur/viewport, dans les deux thèmes). Résultats V3 à vérifier avant fusion.

## V4 — finitions après publication V3

V3 publiée via PR #68, main a1dd7fd65151d613694a7c0de22194d890113b61 ; CI 45491454436 et Pages 45491452423 réussies. Recette V3 : 222 tests de fiabilité et 40 captures, deux moteurs en clair/sombre. Deux détails relevés : sous-textes d'accueil tronqués à petite largeur ; capture Présences prise avant la fin du chargement.

V4 : retour à la ligne des descriptions, grille en une colonne à 360 px et en texte agrandi, aucune modification des libellés ni des actions. Recette étendue aux descriptions visibles et à la présence des onglets réels de la section Présences avant capture. Publication uniquement après CI et contrôle visuel. Aucun changement de données ni de logique métier.

## V5 — interactions et transitions

V4 fusionnée via PR #69 (main 02af9ae9e7864c623c6c7f5ad5a061484b8ec7d7), 223 tests réussis, WebKit et Chromium validés. V5 : transitions de navigation réduites de 460 à 240 ms, déplacement limité à 18 px, en-tête immobile, sens du retour conservé, retours à l'appui et survol modérés, focus visible, limitation de largeur de l'îlot et respect de la réduction des mouvements système/application. Aucun changement React, données ou gestes. Recette navigateur étendue aux transitions avant/retour, aux deux modes de réduction des animations et au focus clavier. Tests V5 et vérification visuelle requis avant fusion.

## V6 — références graphiques utilisateur
V5 CI et recette navigateur réussies (45492620237, 45492620104). V6 : accueil inspiré des deux captures fournies, gris froid/cartes blanches/bleu en clair, graphite et dégradé bleu en sombre, date et salutation réelles, action principale ouvrant le générateur existant, six indicateurs issus des données locales, activité récente issue de l'historique. Aucune donnée fictive ; tiret en cas de données non chargées. Navigation et stockage préservés. Nouveaux tests palette, six cartes et CTA. Rendu et CI V6 à valider avant publication.
