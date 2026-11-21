# Tora — recette Éveil Judo 4–5 ans (V0.5)

> Périmètre : **JSB Manager**, module **Judo** uniquement. Les minuteurs *Moniteur JSB* sont hors périmètre.  
> Statut : document de recette, **non équivalent à une validation en situation réelle**.

## Préalables

- Faire une sauvegarde de la base et des séances du profil actif avant un import ou une manipulation de données.
- Installer une version de test issue de la branche de la PR #53, pas la version `main` en production.
- Préparer un catalogue de contrôle avec des **fiches Judo Éveil explicitement identifiées 4–5 ans**, et conserver une copie d'un catalogue vide de Judo.
- Utiliser des fiches `typeFiche: "Exercice"` avec opposition `Aucune`, `Sans opposition`, `Coopération` ou `Coopération sans résistance`. Aucune technique formelle, projection, immobilisation contrainte ni opposition libre.
- Ne pas importer les histoires comme fiches d'exercices : Tora est une **couche narrative**, les règles de sélection/volume/sécurité restent dans la base Judo.

## Matrice d'acceptation

| ID | Action de contrôle | Résultat attendu | Validation |
| --- | --- | --- | --- |
| TORA-01 | Ouvrir Taïso et Générateur, puis choisir une catégorie Taïso | Aucun panneau ni mode Tora | À effectuer sur appareil |
| TORA-02 | Judo → Éveils 4–5 ans → mode Classique | Aucun récit ; séance Judo inchangée | À effectuer |
| TORA-03 | Éveils → Histoires courtes | Consigne enfant courte sur l'exercice associé ; nom/dosage/sécurité inchangés | À effectuer |
| TORA-04 | Éveils → Aventure complète | Récit original + consigne enfant, introduction et conservation des consignes techniques | À effectuer |
| TORA-05 | Base locale sans fiche Judo correspondante | Panneau « 0 / 24 », détails des 24 absences ; génération non bloquée | À effectuer |
| TORA-06 | Ajouter une fiche au **nom exact**, public Judo, `sousGroupes: ["Éveils (4-5 ans)"]` | Compteur « 1 / 24 », association affichée après chargement | À effectuer |
| TORA-07 | Retirer `public` ou `sousGroupes` de cette fiche **dans une base de test** | Passage en « incompatible », pas en « prête » | Couvert par test automatisé ; appareil à vérifier |
| TORA-08 | Dupliquer une même fiche compatible **dans une base de test** | Diagnostic « doublon » ; ne pas faire d'import dans la base personnelle | Couvert par test automatisé |
| TORA-09 | Remplacer par une fiche Technique, Taïso ou avec opposition dirigée | Aucun récit auto-associé | Couvert par test automatisé |
| TORA-10 | Générer une séance, ajuster un dosage, enregistrer et rouvrir depuis « Mes séances » | Mode narratif et dosages conservés, aucun doublon d'enregistrement | À effectuer |
| TORA-11 | Exporter la même séance en modes Classique, Courtes et Aventure | Seul le texte narratif change ; descriptif technique et vigilance présents, PDF lisible | À effectuer |
| TORA-12 | Sur Safari iPhone, actualiser en ligne, puis essayer le mode avion | Nouvelle version du cache utilisée, bibliothèque Tora présente sans réseau | À effectuer |
| TORA-13 | iPhone portrait/paysage, police agrandie, VoiceOver et clavier | Panneau accessible, résumé utilisable, liste déroulante lisible | À effectuer |
| TORA-14 | Passer à Pré-poussins, Poussins puis Taïso | Aucun report d'histoire ou de mode non autorisé sur ces catégories | À effectuer |

## Séance étalon indicative — 45 minutes

Cette trame sert à **vérifier les compteurs et le rendu**, pas à créer des exercices dans une base personnelle.

| Phase | Durée | Contenu indicatif, uniquement si les fiches correspondantes ont été vérifiées |
| --- | ---: | --- |
| Accueil et salut | 5 min | Rassemblement, repérage du tatami et salut ; le rituel ne nécessite pas d'inventer une fiche |
| Jeux moteurs | 10 min | Empreintes au sol ; orientation vers un signal visuel |
| Parcours moteurs | 13 min | Passage entre plots, passage sous arche souple fixe ; zones séparées, sens unique |
| Jeux coopératifs | 10 min | Transport léger à deux, déplacement coordonné ; coopération sans traction |
| Retour au calme et salut | 7 min | Réinvestissement lent et retour à une posture confortable, bilan, salut |
| **Total** | **45 min** | Les temps incluent consignes, changements d'atelier et récupération |

**Arrêt immédiat** en cas de douleur, peur importante, vertige ou instabilité. L'enseignant adapte l'organisation et les variantes ; les récits n'autorisent aucune situation d'opposition supplémentaire.

## Critères de passage à `main`

1. Tous les tests de la PR passent, notamment `node --test tests/*.test.cjs`.
2. Les 24 associations sont comparées à la **base Judo réelle importée localement** et les écarts de noms sont corrigés **dans un fichier contrôlé**, pas silencieusement.
3. Un éducateur valide sur tapis l'âge, la compétence visée, les prérequis, l'organisation, les variantes et la sécurité de chaque fiche retenue.
4. Les essais iPhone/Safari/PWA, le PDF multipage et la reprise de séance sont validés.
5. Les droits relatifs au personnage et à d'éventuelles collaborations avec Kodomo sont clarifiés ; aucun élément officiel France Judo n'est reproduit sans autorisation.
6. La PR #53 peut alors être revue et sortie de son état de brouillon. **Aucune fusion automatique.**

## Diagnostic

Le compteur « histoires disponibles » signale uniquement les **correspondances techniques** dans le catalogue actif (nom technique, discipline et groupe explicites, absence d'opposition non autorisée). Il ne certifie ni la qualité scientifique de l'exercice, ni sa sécurité absolue, ni sa disponibilité chez tous les utilisateurs.

Dans la publication publique du dépôt, `illustres/catalogue.json` contient **10 fiches Taïso et aucune fiche Judo**, ce qui donne normalement 0 / 24 sur cette base seule. La base d'un coach peut être différente, car elle est importée sur son appareil.
