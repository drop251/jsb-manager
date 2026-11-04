# JSB Manager

Application de préparation physique, judo, taïso et suivi des présences — Judo Sans Barrières.

Installable sur iPhone (Safari › Partager › Sur l’écran d’accueil). Les données personnelles restent sur l’appareil ; aucune synchronisation entre appareils n’est fournie.

La base principale d’exercices est importée sur l’appareil. Le dépôt contient dix exercices illustrés publics et un catalogue supplémentaire chiffré.

## Sauvegarder et restaurer

Depuis **Présences › Sauvegarde**, ou **Mon compte › Sauvegarder tout mon espace**, créez une sauvegarde chiffrée. Elle contient les présences, le planning, les séances, les favoris, la sélection, les routines, la base importée, les exercices ajoutés et les images, illustrations et vidéos personnelles. Les médias personnels sont communs aux profils de l’appareil ; la sauvegarde contient ceux de cet appareil. Les médias du catalogue publié sont téléchargés séparément.

Le mot de passe est conservé uniquement en mémoire pendant l’ouverture de la page. Les anciennes valeurs enregistrées en clair sont supprimées à l’ouverture. Conservez votre mot de passe dans un gestionnaire : il reste nécessaire pour ouvrir les fichiers déjà exportés.

Après le partage ou le téléchargement, vérifiez la présence du fichier avant de confirmer sa conservation. Annuler l’export ou cette confirmation ne change pas la date de dernière sauvegarde.

La restauration complète remplace les données du profil actif, la base importée, les médias personnels communs et les réglages inclus. Exportez l’espace actuel avant de restaurer. Les écritures IndexedDB sont effectuées dans une seule transaction ; les réglages locaux sont rétablis si cette transaction échoue. Les anciennes sauvegardes de présences restent lisibles et conservent leur ancien périmètre.

## Préparer une séance hors ligne

Ouvrez l’application avec une connexion, puis une séance en direct. Utilisez **Préparer hors ligne** et attendez sa confirmation. Cette action met en cache le catalogue et les médias nécessaires à la séance, et vérifie les vidéos personnelles. Répétez la préparation après modification de la séance. Les vidéos mises en cache prennent en charge les requêtes par plages de Safari.

L’état hors ligne dépend du stockage conservé par le navigateur. Le minuteur et les signaux en arrière-plan ne sont pas garantis : gardez l’application visible pendant le cours.

## Vérifications

Sans dépendance supplémentaire :

```sh
node --test tests/reliability.test.cjs
```

Les tests couvrent le chiffrement, la restauration des vidéos, les anciens fichiers, les annulations de partage et téléchargement, la confirmation de conservation, l’échec de stockage, les médias hors ligne et les plages vidéo.

La vérification physique sur Safari iPhone reste nécessaire pour le partage, la lecture des vidéos et la disposition en portrait/paysage.

## Mise à jour du générateur (1er novembre 2026)

- Les préférences du générateur, modèles Taïso et brouillons de préparation Judo/Taïso sont inclus dans les nouvelles sauvegardes complètes chiffrées. Les sauvegardes antérieures restent lisibles ; elles ne contiennent pas rétroactivement ces éléments.
- Les brouillons de « Ma séance » récupèrent les informations et dosages saisis après une fermeture ou un rechargement, sur le même appareil et le même profil.
- La génération Taïso respecte les filtres de niveau, d'accessibilité et les contraintes du groupe. Si le catalogue contient trop peu d'exercices compatibles, l'application signale les manques au lieu d'élargir silencieusement les niveaux.
- Le choix explicite « Sans matériel » limite les propositions au poids du corps et au tatami. Sans équipement sélectionné et sans ce mode, le comportement historique (tout matériel disponible) reste conservé.
- La répartition temporelle des phases respecte 45, 60, 75 ou 90 minutes. Les remplacements sont priorisés selon la catégorie, la zone de travail et la technique plutôt qu'au hasard.
- Deux préparations du même jour et du même cours peuvent être enregistrées séparément ; les écritures qui échouent ne sont plus annoncées comme réussies.

**Précision :** les calculs de la séance proposée et les durées réellement animées par l'éducateur peuvent différer selon les transitions pédagogiques. Valider sur iPhone les écrans, les supports importés et l'utilisation hors ligne avant une utilisation en cours. L'application indépendante Moniteur JSB ne fait pas partie de ce dépôt.

## Interface de préparation simplifiée (1er novembre 2026)

- L'écran Taïso conserve ses réglages essentiels visibles ; les modèles, le matériel détaillé et les adaptations au groupe sont repliés par défaut et restent accessibles avec un résumé de la sélection. Aucun filtre existant n'est effacé lors de l'ouverture ou la fermeture de ces rubriques.
- « Remplacer » affiche désormais jusqu'à cinq exercices compatibles et classés par pertinence : rien ne change tant que l'éducateur n'a pas choisi un remplaçant. Le retrait, le remplacement et le dosage peuvent être annulés avec « Annuler la dernière retouche ».
- Le nombre d'exercices et la durée de la proposition sont affichés dans l'en-tête de la séance ; les minutes des exercices d'une même phase (hors blocs de travail) sont réparties sans dépasser sa durée totale.
- Le cache hors ligne a changé de version pour déclencher l'installation de la nouvelle interface. Si l'ancienne version reste affichée sur l'écran d'accueil iPhone, ouvrir l'app avec une connexion puis la relancer après mise à jour du service worker.

Les tests automatiques vérifient les calculs et le flux de remplacement. Ils ne remplacent pas une vérification ergonomique et fonctionnelle sur un véritable iPhone.

## Correction : annuler une préparation de séance (1er novembre 2026)

- **Générer une séance**, en Judo comme en Taïso : un bouton « Annuler la préparation » est visible à chaque étape et sur la proposition. Fermer depuis le fond de fenêtre ou la touche Échap demande aussi confirmation.
- Une génération abandonnée ne modifie plus les préférences enregistrées du générateur ; les préférences et la routine choisie sont enregistrées après validation effective dans « Ma séance ».
- **Ma séance** : « Annuler la préparation » efface, après confirmation, les exercices sélectionnés ainsi que les informations et durées du brouillon courant. Les séances enregistrées dans l'historique ne sont pas supprimées. Un échec de stockage laisse le brouillon intact et affiche un message.
- La proposition transférée dans « Ma séance » est consommée une seule fois : elle ne se réinstalle plus après navigation entre les écrans.
- Correction de deux fonctions homonymes de matériel qui perturbaient les listes de matériel des circuits Taïso et des modèles.
- La navigation automatique de l'assistant Judo ne dépend plus d'un délai de 120 ms ; une erreur de génération affiche un message explicite au lieu d'un écran cassé.

Après mise à jour sur iPhone, rouvrir JSB Manager avec une connexion pour recevoir la nouvelle version hors ligne. Contrôler les parcours sur un véritable appareil avant emploi en cours.


## Objectifs pédagogiques Judo (3 novembre 2026)

- Le générateur **Judo** propose désormais huit objectifs propres à l'apprentissage : Découverte et initiation ; Apprentissage technique ; Perfectionnement technique ; Déplacements et déséquilibres ; Enchaînements et combinaisons ; Défense et contre-attaques ; Travail au sol — Ne-waza ; Opposition et randori.
- La sélection privilégie les exercices dont le nom, la thématique, la famille technique ou la description correspondent à l'objectif choisi, tout en conservant les filtres par catégorie d'âge et les techniques sélectionnées.
- Si aucun exercice ciblé n'est disponible pour un objectif dans la tranche d'âge choisie, un avertissement s'affiche : le générateur ne prétend pas avoir couvert cet objectif.
- Les objectifs et le fonctionnement du générateur **Taïso** restent inchangés. Les catégories physiques internes des fiches Judo sont conservées pour le classement existant.
- Contrôles : validation de la syntaxe JavaScript et tests automatisés sur les correspondances d'objectifs, les séances Judo/Taïso et les opérations de sauvegarde ; vérification visuelle sur iPhone restant nécessaire.


## Générateur Judo : critères pédagogiques et contrôle des imports (4 novembre 2026)

Six données pédagogiques supplémentaires sont prises en compte pour les fiches Judo :
- `competenceCiblee` : apprentissage précis visé (texte explicite).
- `rolePedagogique` : `Préparation`, `Découverte`, `Acquisition`, `Consolidation`, `Réinvestissement`, `Application`, `Opposition` ou `Retour au calme`.
- `prerequis` : compétence devant être acquise avant l'exercice, ou `Aucun`.
- `niveauOpposition` : `Sans opposition`, `Coopération`, `Opposition dirigée` ou `Opposition libre`.
- `organisation` : consignes d'organisation, rôle de Tori/Uke en binôme ou trio, alternances/rotations, récupération.
- `dureeBlocMin` : durée réaliste du bloc en minutes (nombre compris entre 1 et 30).

Ces six champs sont obligatoires pour les nouvelles fiches Judo importées, en plus des champs de base : nom, description, thématique, dosage, vigilance, critère de réussite, catégorie d'âge, grade, famille technique, moment, format, matériel, variante facile et difficile. Les données absentes provoquent un **refus détaillé** avant enregistrement. Le refus d'une fiche bloque l'import entier (pas de chargement partiel). Les images et vidéos ajoutées seules à un exercice existant ne nécessitent pas une nouvelle fiche complète. Une fiche ancienne déjà présente n'est pas supprimée ni bloquée parce qu'elle ne possède pas encore les six nouvelles données.

Une fiche existante importée avec ses mêmes nom/public, une description complète et les nouveaux champs est **mise à jour sur son identifiant actuel**, sans création de doublon ; ses images et vidéos sont conservées. Une correction incomplète d'une fiche existante est refusée. Les familles techniques explicitement renseignées sont préservées.

Le générateur Judo utilise les champs pédagogiques enrichis pour prioriser les compétences correspondantes, contrôler les rôles par phase et les prérequis déclarés, limiter les niveaux d'opposition et tenir compte de l'organisation et des durées réalistes. Les anciens exercices sans métadonnées restent disponibles, mais la séance signale les durées estimées et les éventuels manques. Les remplacements d'exercices tiennent compte des mêmes critères. Le générateur Taïso reste indépendant.

Dans le générateur Judo, ouvrir **Critères pédagogiques avancés** à l'étape Technique pour préciser, si nécessaire, la compétence ciblée, les prérequis acquis, l'opposition maximale, l'organisation et la durée cible des blocs. Le rôle pédagogique est déduit de chaque phase, puis comparé aux champs des fiches. Les notes d'organisation sont aussi visibles dans la proposition et l'export PDF.

Les tests exécutés sous Node.js couvrent la validation des champs, le refus d'import, les reprises de fiches existantes, la conservation des médias et la répartition des durées. Une validation finale des parcours et de la lisibilité des fiches PDF sur iPhone reste nécessaire ; la présence de six champs ne garantit pas à elle seule la pertinence d'une séance.

## Trames Judo par âge : PDF indicatif, génération libre (4 novembre 2026)

La **fiche de séance PDF est un modèle indicatif**, pas un contrat rigide sur les intitulés ou sur les durées de la séance. Le générateur conserve cinq temps d'organisation pour aider à répartir le cours, mais **affiche des libellés pédagogiques différents** selon l'âge. Les intitulés et, pour les plus jeunes, les budgets de phase sont ajustables dans « Ma séance » avant le PDF. Les phases techniques internes restent les mêmes pour conserver la compatibilité de la sélection et de l'historique. Les anciennes séances déjà enregistrées (trame 2) gardent leurs anciens intitulés ; les nouvelles utilisent la trame 3.

- **Éveils Judo (4–5 ans)** : accueil et salut ; jeux moteurs ; parcours moteurs ; jeux coopératifs ; retour au calme. Pas de technique formelle ni de randori ; la sélection priorise les activités motrices, ludiques et la coopération. L'accueil et les pauses peuvent exister sans fiche d'exercice artificielle.
- **Pré-poussins (6–7 ans)** : accueil et mobilité ; jeux moteurs ; bases du Judo ; opposition éducative ; retour au calme. Les situations d'opposition restent dirigées et progressives, sans randori libre imposé.
- **Poussins, Benjamins, Minimes, Cadets, Juniors et Adultes** : intitulés évolutifs, du jeu et de l'apprentissage initial aux situations technico-tactiques et randori des plus grands. Le choix de l'objectif, les prérequis, les rôles et les niveaux d'opposition continuent à gouverner les exercices, indépendamment des titres.
- **Taïso** : conserve son générateur et ses intitulés propres, sans reprendre la trame d'Éveil Judo.
- **Durées** : propositions adaptées à la catégorie (par exemple 30 à 60 minutes pour l'Éveil), mais elles ne proviennent pas du PDF et ne servent pas de verrou de génération. Le moteur jeunes accepte les durées saisies de 20 à 120 minutes, en signalant les séances d'Éveil inhabituellement longues.
- **Catalogue incomplet** : les temps d'accueil, de consignes, de transitions et de salut sont affichés comme tels. Le moteur indique les activités manquantes et ne prétend pas avoir proposé un exercice inexistant.
- **Parcours du générateur** : la routine initiale Judo est facultative et le choix d'une famille technique n'est pas obligatoire en Éveil ou en Pré-poussins. Les prérequis explicitement exigés par une fiche ne sont pas présumés acquis.

La mise à jour comporte des tests automatisés sur les différentes trames, l'absence de techniques formelles en Éveil, les oppositions dirigées en Pré-poussins, la conservation des anciennes trames et le total des minutes. La vérification sur iPhone et la validation pédagogique de séances issues du catalogue réel restent nécessaires.
