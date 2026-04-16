#!/bin/bash

VERSION="$1"

if [ -z "$VERSION" ]; then
    echo "Ошибка: укажите версию"
    echo "Пример: ./release.sh 1.0.0"
    exit 1
fi

# 1. Собрали build
echo "Сборка..."
./build.sh "$VERSION" local

# 2. Переключились на релизную ветку
echo "Переключение на релизную ветку..."
git checkout -b "release/${VERSION}" 2>/dev/null || git checkout "release/${VERSION}"

# 3. Скопировали build поверх
echo "Копирование файлов..."
cp -rf build/* . 2>/dev/null
cp -rf build/.[!.]* . 2>/dev/null

# 4. Удалили папку build из релизной ветки
rm -rf build

# 5. Закоммитили
echo "Коммит..."
git add .
git commit -m "Release ${VERSION}"

# 6. Публикуем бранч
echo "Публикация бранча в GitHub..."
git push origin "release/${VERSION}" --force

# 7. Создаем тег
echo "Создание тега..."
git tag -a "v${VERSION}" -m "Version ${VERSION}"
git push origin "v${VERSION}"

# 8. Возвращаемся
git checkout -

echo ""
echo "========================================="
echo "ГОТОВО!"
echo "========================================="
echo "Релизная ветка: release/${VERSION}"
echo "Тег: v${VERSION}"
echo "========================================="
echo "Ссылка на создание PR:"
REPO=$(git config --get remote.origin.url | sed 's/.*:\(.*\)\.git/\1/')
echo "https://github.com/${REPO}/compare/main...release/${VERSION}"
echo "========================================="