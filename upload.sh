#!/bin/bash

# Script para subir arquivos para o GitHub automaticamente

# Verifica se uma mensagem de commit foi fornecida
if [ -z "$1" ]; then
    echo "Erro: Por favor, forneça uma mensagem de commit."
    echo "Uso: ./upload.sh \"sua mensagem aqui\""
    exit 1
fi

COMMIT_MESSAGE=$1

echo "--- Iniciando processo de upload ---"

# Adiciona todos os arquivos
echo "1. Adicionando arquivos..."
git add .

# Faz o commit
echo "2. Realizando commit: \"$COMMIT_MESSAGE\""
git commit -m "$COMMIT_MESSAGE"

# Faz o push (assume que o branch atual é 'main')
# Pequena verificação do branch atual caso não seja main
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "3. Enviando para o GitHub (branch: $CURRENT_BRANCH)..."
git push origin "$CURRENT_BRANCH"

echo "--- Processo concluído com sucesso! ---"
