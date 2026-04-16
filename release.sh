#!/bin/bash
# release.sh

VERSION="$1"
MODE="$2"  # local или global

if [ -z "$VERSION" ]; then
    echo "Введите версию:"
    read VERSION
fi

if [ -z "$MODE" ]; then
    echo "Режим (local/global):"
    read MODE
fi

RELEASE_BRANCH="release/${VERSION}"

# 1. Собираем build
echo "Сборка в режиме ${MODE}..."
./build.sh "$VERSION" "$MODE"

# 2. Сохраняем текущую ветку
CURRENT_BRANCH=$(git branch --show-current)

# 3. Переключаемся на релизную ветку
git checkout -b "$RELEASE_BRANCH" 2>/dev/null || git checkout "$RELEASE_BRANCH"

# 4. Копируем папку build (перезаписываем)
rm -rf ./build
cp -r ../build ./build

# 5. Коммитим и пушим
git add build/
git commit -m "Release ${VERSION} (${MODE})"
git push origin "$RELEASE_BRANCH"

# 6. Возвращаемся
git checkout "$CURRENT_BRANCH"

echo "Готово! Релиз в ветке ${RELEASE_BRANCH}"