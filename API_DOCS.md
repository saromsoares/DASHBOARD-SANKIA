# 📚 Documentação da API Sankhya (Backend)

Aqui estão os endpoints disponíveis para você configurar as **Intenções do Gptmaker**.

URL Base (Exemplo): `http://SEU_VPS_IP:3000`

> [!IMPORTANT]
> É obrigatório enviar o cabeçalho **`Content-Type: application/json`** em todas as requisições POST.
> Se você não enviar isso, o sistema não vai reconhecer o corpo da requisição e pode retornar erro.

---

## 1. Consultar Produto (Busca Inteligente)
Busca produtos por nome, descrição ou código. Retorna os 5 principais resultados com estoque e preço.

*   **Método:** `POST`
*   **URL:** `/api/produto`
*   **Body (JSON):**
    ```json
    {
      "termo": "lampada led"
    }
    ```
*   **Descrição:** Usa o termo informado para buscar produtos ativos na base.
*   **Exemplo de Resposta (Texto Pronta):**
    > Encontrei 5 produtos. Aqui estão os principais:
    > 📦 *LÂMPADA LED...* (Cód: 123)
    > Ref: REF123 | Estoque: *100 un.* | Preço: *R$ 15,90*

---

## 2. Consultar Preço Específico
Busca o preço de um produto específico em uma tabela de preço (padrão tabela 6).

*   **Método:** `POST`
*   **URL:** `/api/preco`
*   **Body (JSON):**
    ```json
    {
      "codigo": 397,
      "tabela": 6
    }
    ```
    *(O campo "tabela" é opcional, padrão é 6)*
*   **Descrição:** Retorna o preço formatado e o valor bruto.
*   **Exemplo de Resposta:**
    > 💰 *Produto Exemplo*
    > Tabela: 6
    > Valor: R$ 53.00

---

## 3. Consultar Nota Fiscal (Status e Itens)
Busca informações detalhadas de uma Nota Fiscal pelo número (NUNOTA ou NUMNOTA).

*   **Método:** `POST`
*   **URL:** `/api/fiscal`
*   **Body (JSON):**
    ```json
    {
      "numero_nota": 23534
    }
    ```
*   **Descrição:** Retorna status, data, valor total, cliente e lista de itens da nota.
*   **Exemplo de Resposta:**
    > 📄 *NOTA FISCAL 23534*
    > 📅 Emissão: 25/01/2026
    > 📦 Status: Aprovada
    > ...
    > *ITENS:*
    > 1. Produto A (x2) - R$ 100.00

---

## 4. Consultar Pendências Financeiras
Verifica se um parceiro tem títulos em aberto.

*   **Método:** `POST`
*   **URL:** `/api/financeiro`
*   **Body (JSON):**
    ```json
    {
      "cnpj_cpf": "12345678000199"
    }
    ```
*   **Descrição:** Busca títulos vencidos ou a vencer para o CPF/CNPJ informado.
*   **Exemplo de Resposta:**
    > 💰 *Financeiro - Parceiro X*
    > Títulos em Aberto: 2
    > Valor Total: R$ 1500.00
