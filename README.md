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
