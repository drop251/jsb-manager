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
