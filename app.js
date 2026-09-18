/* =========================================================
   MONIEPOINT PERSONAL RECORD
   Main Application Logic
   ========================================================= */


/* =========================================================
   1. DATABASE CONFIGURATION
   ========================================================= */

const DB_NAME = "MoniepointPersonalRecord";
const DB_VERSION = 1;

const DAY_STORE = "days";
const TRANSACTION_STORE = "transactions";

let db = null;

let currentDay = null;
let currentEditingTransactionId = null;

let selectedTransactionType = "withdrawal";
let selectedTransactionFilter = "all";

let currentScreen = "dashboard";

let modalConfirmAction = null;


/* =========================================================
   2. DOM HELPERS
   ========================================================= */

const $ = (id) => document.getElementById(id);

const $$ = (selector) =>
    document.querySelectorAll(selector);


/* =========================================================
   3. FORMAT MONEY
   ========================================================= */

function formatMoney(value) {

    const number = Number(value) || 0;

    return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(number);
}


/* =========================================================
   4. FORMAT DATE
   ========================================================= */

function formatDate(dateValue) {

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return new Intl.DateTimeFormat("en-NG", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    }).format(date);
}


/* =========================================================
   5. FORMAT TIME
   ========================================================= */

function formatTime(dateValue) {

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return new Intl.DateTimeFormat("en-NG", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
    }).format(date);
}


/* =========================================================
   6. FORMAT DATE + TIME
   ========================================================= */

function formatDateTime(dateValue) {

    return `${formatDate(dateValue)} • ${formatTime(dateValue)}`;
}


/* =========================================================
   7. DATABASE INITIALIZATION
   ========================================================= */

function openDatabase() {

    return new Promise((resolve, reject) => {

        const request = indexedDB.open(
            DB_NAME,
            DB_VERSION
        );


        request.onupgradeneeded = (event) => {

            const database = event.target.result;


            /* Days store */

            if (!database.objectStoreNames.contains(DAY_STORE)) {

                const dayStore = database.createObjectStore(
                    DAY_STORE,
                    {
                        keyPath: "id"
                    }
                );


                dayStore.createIndex(
                    "status",
                    "status",
                    { unique: false }
                );


                dayStore.createIndex(
                    "dateKey",
                    "dateKey",
                    { unique: false }
                );

            }


            /* Transactions store */

            if (
                !database.objectStoreNames.contains(
                    TRANSACTION_STORE
                )
            ) {

                const transactionStore =
                    database.createObjectStore(
                        TRANSACTION_STORE,
                        {
                            keyPath: "id",
                            autoIncrement: true
                        }
                    );


                transactionStore.createIndex(
                    "dayId",
                    "dayId",
                    { unique: false }
                );


                transactionStore.createIndex(
                    "receiptNumber",
                    "receiptNumber",
                    { unique: false }
                );


                transactionStore.createIndex(
                    "type",
                    "type",
                    { unique: false }
                );


                transactionStore.createIndex(
                    "createdAt",
                    "createdAt",
                    { unique: false }
                );

            }

        };


        request.onsuccess = (event) => {

            db = event.target.result;

            resolve(db);

        };


        request.onerror = () => {

            reject(request.error);

        };

    });

}


/* =========================================================
   8. DATABASE TRANSACTION HELPER
   ========================================================= */

function dbRequest(
    storeName,
    mode,
    callback
) {

    return new Promise((resolve, reject) => {

        if (!db) {

            reject(
                new Error("Database is not initialized.")
            );

            return;
        }


        const transaction =
            db.transaction(
                storeName,
                mode
            );


        const store =
            transaction.objectStore(storeName);


        let request;

        try {

            request = callback(store);

        } catch (error) {

            reject(error);

            return;
        }


        request.onsuccess = () => {

            resolve(request.result);

        };


        request.onerror = () => {

            reject(request.error);

        };

    });

}


/* =========================================================
   9. GET ALL RECORDS
   ========================================================= */

function getAllRecords(storeName) {

    return dbRequest(
        storeName,
        "readonly",
        (store) => store.getAll()
    );

}


/* =========================================================
   10. GET ONE RECORD
   ========================================================= */

function getRecord(
    storeName,
    id
) {

    return dbRequest(
        storeName,
        "readonly",
        (store) => store.get(id)
    );

}


/* =========================================================
   11. ADD RECORD
   ========================================================= */

function addRecord(
    storeName,
    data
) {

    return dbRequest(
        storeName,
        "readwrite",
        (store) => store.add(data)
    );

}


/* =========================================================
   12. UPDATE RECORD
   ========================================================= */

function updateRecord(
    storeName,
    data
) {

    return dbRequest(
        storeName,
        "readwrite",
        (store) => store.put(data)
    );

}


/* =========================================================
   13. DELETE RECORD
   ========================================================= */

function deleteRecord(
    storeName,
    id
) {

    return dbRequest(
        storeName,
        "readwrite",
        (store) => store.delete(id)
    );

}


/* =========================================================
   14. GENERATE DATE KEY
   ========================================================= */

function getDateKey(dateValue = new Date()) {

    const date = new Date(dateValue);

    const year =
        date.getFullYear();

    const month =
        String(date.getMonth() + 1)
            .padStart(2, "0");

    const day =
        String(date.getDate())
            .padStart(2, "0");

    return `${year}-${month}-${day}`;

}


/* =========================================================
   15. FIND CURRENT OPEN DAY
   ========================================================= */

async function getOpenDay() {

    const days =
        await getAllRecords(DAY_STORE);


    return days.find(
        (day) => day.status === "open"
    ) || null;

}


/* =========================================================
   16. GET TRANSACTIONS FOR DAY
   ========================================================= */

async function getDayTransactions(dayId) {

    const transactions =
        await getAllRecords(
            TRANSACTION_STORE
        );


    return transactions

        .filter(
            (transaction) =>
                transaction.dayId === dayId
        )

        .sort(
            (a, b) =>
                new Date(b.createdAt) -
                new Date(a.createdAt)
        );

}


/* =========================================================
   17. GET NEXT RECEIPT NUMBER
   ========================================================= */

async function getNextReceiptNumber(dayId) {

    const transactions =
        await getDayTransactions(dayId);


    if (transactions.length === 0) {
        return "0001";
    }


    const numbers =
        transactions.map(
            (transaction) =>
                Number(transaction.receiptNumber) || 0
        );


    const highest =
        Math.max(...numbers);


    return String(highest + 1)
        .padStart(4, "0");

}


/* =========================================================
   18. SHOW SCREEN
   ========================================================= */

function showScreen(screenName) {

    const screens = {

        dashboard:
            $("dashboardScreen"),

        transaction:
            $("transactionScreen"),

        transactions:
            $("transactionsScreen"),

        endDay:
            $("endDayScreen"),

        history:
            $("historyScreen"),

        report:
            $("reportScreen"),

        settings:
            $("settingsScreen"),

        startDay:
            $("startDayScreen")

    };


    Object.values(screens).forEach(
        (screen) => {

            if (screen) {
                screen.classList.add("hidden");
            }

        }
    );


    if (screens[screenName]) {

        screens[screenName]
            .classList.remove("hidden");

    }


    currentScreen = screenName;


    updateNavigation(
        screenName
    );


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


/* =========================================================
   19. UPDATE BOTTOM NAVIGATION
   ========================================================= */

function updateNavigation(screenName) {

    const navigation =
        $("bottomNavigation");


    if (
        !currentDay ||
        screenName === "startDay"
    ) {

        navigation.classList.add(
            "hidden"
        );

        return;

    }


    navigation.classList.remove(
        "hidden"
    );


    $$(".nav-item").forEach(
        (item) => {

            item.classList.remove(
                "active"
            );

        }
    );


    const activeItem =
        document.querySelector(
            `.nav-item[data-screen="${screenName}"]`
        );


    if (activeItem) {

        activeItem.classList.add(
            "active"
        );

    }

}


/* =========================================================
   20. UPDATE OPENING TOTAL
   ========================================================= */

function updateOpeningTotal() {

    const cash =
        Number(
            $("openingCash").value
        ) || 0;


    const pos =
        Number(
            $("openingPos").value
        ) || 0;


    $("openingTotal").textContent =
        formatMoney(cash + pos);

}


/* =========================================================
   21. UPDATE CLOSING TOTAL
   ========================================================= */

function updateClosingTotal() {

    const cash =
        Number(
            $("closingCash").value
        ) || 0;


    const pos =
        Number(
            $("closingPos").value
        ) || 0;


    $("closingTotal").textContent =
        formatMoney(cash + pos);

}


/* =========================================================
   22. RENDER DASHBOARD
   ========================================================= */

async function renderDashboard() {

    if (!currentDay) {
        return;
    }


    $("currentDayDate").textContent =
        formatDate(
            currentDay.startedAt
        );


    $("dayStatus").textContent =
        currentDay.status === "open"
            ? "OPEN"
            : "CLOSED";


    $("dayStatus").className =
        `status-badge ${
            currentDay.status
        }`;


    $("dashboardOpeningCash")
        .textContent =
        formatMoney(
            currentDay.openingCash
        );


    $("dashboardOpeningPos")
        .textContent =
        formatMoney(
            currentDay.openingPos
        );


    $("dashboardOpeningTotal")
        .textContent =
        formatMoney(
            currentDay.openingTotal
        );


    const transactions =
        await getDayTransactions(
            currentDay.id
        );


    $("transactionCount")
        .textContent =
        transactions.length;


    const totalCharges =
        transactions.reduce(
            (total, transaction) =>
                total +
                Number(
                    transaction.charge
                ),

            0
        );


    $("totalCharges")
        .textContent =
        formatMoney(totalCharges);

}


/* =========================================================
   23. START NEW DAY
   ========================================================= */

async function startNewDay() {

    const existingOpenDay =
        await getOpenDay();


    if (existingOpenDay) {

        showToast(
            "You already have an open working day."
        );

        currentDay =
            existingOpenDay;

        renderDashboard();

        showScreen("dashboard");

        return;

    }


    const cash =
        Number(
            $("openingCash").value
        );


    const pos =
        Number(
            $("openingPos").value
        );


    if (
        !Number.isFinite(cash) ||
        cash < 0
    ) {

        showToast(
            "Enter a valid opening cash amount."
        );

        $("openingCash").focus();

        return;

    }


    if (
        !Number.isFinite(pos) ||
        pos < 0
    ) {

        showToast(
            "Enter a valid opening POS balance."
        );

        $("openingPos").focus();

        return;

    }


    const now =
        new Date();


    const day = {

        id:
            `day_${now.getTime()}`,

        dateKey:
            getDateKey(now),

        status:
            "open",

        openingCash:
            cash,

        openingPos:
            pos,

        openingTotal:
            cash + pos,

        startedAt:
            now.toISOString(),

        closedAt:
            null,

        closingCash:
            null,

        closingPos:
            null,

        closingTotal:
            null

    };


    try {

        await addRecord(
            DAY_STORE,
            day
        );


        currentDay =
            day;


        $("openingCash").value =
            "";

        $("openingPos").value =
            "";


        await renderDashboard();

        showScreen("dashboard");


        showToast(
            "Working day started successfully."
        );

    } catch (error) {

        console.error(error);

        showToast(
            "Unable to start the day."
        );

    }

}


/* =========================================================
   24. PREPARE TRANSACTION FORM
   ========================================================= */

function prepareNewTransaction() {

    currentEditingTransactionId =
        null;


    selectedTransactionType =
        "withdrawal";


    $$(".type-button").forEach(
        (button) => {

            button.classList.toggle(
                "active",
                button.dataset.type ===
                "withdrawal"
            );

        }
    );


    $("transactionAmount").value =
        "";


    $("transactionCharge").value =
        "0";


    $("transactionNote").value =
        "";


    $("saveTransactionBtn")
        .textContent =
        "Save Transaction";


    showScreen("transaction");


    setTimeout(
        () => {
            $("transactionAmount")
                .focus();
        },
        100
    );

}


/* =========================================================
   25. SAVE TRANSACTION
   ========================================================= */

async function saveTransaction() {

    if (!currentDay) {

        showToast(
            "Start a working day first."
        );

        showScreen("startDay");

        return;

    }


    if (
        currentDay.status !== "open"
    ) {

        showToast(
            "This working day is already closed."
        );

        return;

    }


    const amount =
        Number(
            $("transactionAmount").value
        );


    const charge =
        Number(
            $("transactionCharge").value
        ) || 0;


    const note =
        $("transactionNote")
            .value
            .trim();


    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {

        showToast(
            "Enter a valid transaction amount."
        );

        $("transactionAmount").focus();

        return;

    }


    if (
        !Number.isFinite(charge) ||
        charge < 0
    ) {

        showToast(
            "Enter a valid charge."
        );

        $("transactionCharge").focus();

        return;

    }


    try {

        const now =
            new Date();


        /* =================================================
           EDIT EXISTING TRANSACTION
        ================================================= */

        if (
            currentEditingTransactionId !==
            null
        ) {

            const existing =
                await getRecord(
                    TRANSACTION_STORE,
                    currentEditingTransactionId
                );


            if (!existing) {

                showToast(
                    "Transaction could not be found."
                );

                return;

            }


            existing.type =
                selectedTransactionType;

            existing.amount =
                amount;

            existing.charge =
                charge;

            existing.note =
                note;

            existing.updatedAt =
                now.toISOString();


            await updateRecord(
                TRANSACTION_STORE,
                existing
            );


            currentEditingTransactionId =
                null;


            $("saveTransactionBtn")
                .textContent =
                "Save Transaction";


            await renderDashboard();

            await renderTransactions();

            showScreen("transactions");


            showToast(
                `Receipt ${existing.receiptNumber} updated.`
            );


            return;

        }


        /* =================================================
           CREATE NEW TRANSACTION
        ================================================= */

        const receiptNumber =
            await getNextReceiptNumber(
                currentDay.id
            );


        const transaction = {

            dayId:
                currentDay.id,

            receiptNumber:
                receiptNumber,

            type:
                selectedTransactionType,

            amount:
                amount,

            charge:
                charge,

            note:
                note,

            createdAt:
                now.toISOString(),

            updatedAt:
                null

        };


        await addRecord(
            TRANSACTION_STORE,
            transaction
        );


        $("transactionAmount").value =
            "";

        $("transactionCharge").value =
            "0";

        $("transactionNote").value =
            "";


        await renderDashboard();


        showScreen("dashboard");


        showToast(
            `Transaction ${receiptNumber} saved.`
        );

    } catch (error) {

        console.error(error);

        showToast(
            "Unable to save transaction."
        );

    }

}


/* =========================================================
   26. RENDER TRANSACTIONS
   ========================================================= */

async function renderTransactions() {

    if (!currentDay) {
        return;
    }


    const allTransactions =
        await getDayTransactions(
            currentDay.id
        );


    const search =
        $("transactionSearch")
            .value
            .trim()
            .toLowerCase();


    let transactions =
        allTransactions.filter(
            (transaction) => {

                const matchesFilter =
                    selectedTransactionFilter ===
                    "all" ||
                    transaction.type ===
                    selectedTransactionFilter;


                const searchableText =
                    [
                        transaction.receiptNumber,
                        transaction.type,
                        transaction.amount,
                        transaction.charge,
                        transaction.note
                    ]
                    .join(" ")
                    .toLowerCase();


                const matchesSearch =
                    !search ||
                    searchableText.includes(
                        search
                    );


                return (
                    matchesFilter &&
                    matchesSearch
                );

            }
        );


    const list =
        $("transactionList");


    list.innerHTML =
        "";


    $("emptyTransactions")
        .classList.toggle(
            "hidden",
            transactions.length !== 0
        );


    if (
        allTransactions.length === 0
    ) {

        $("emptyTransactions")
            .classList.remove(
                "hidden"
            );

        return;

    }


    transactions.forEach(
        (transaction) => {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "transaction-card";


            const typeLabel =
                transaction.type
                    .charAt(0)
                    .toUpperCase() +
                transaction.type
                    .slice(1);


            card.innerHTML = `

                <div class="transaction-top">

                    <div class="transaction-receipt">

                        <span class="receipt-number">
                            #${escapeHtml(
                                transaction.receiptNumber
                            )}
                        </span>

                        <span class="transaction-type">
                            ${escapeHtml(
                                typeLabel
                            )}
                        </span>

                    </div>

                    <strong class="transaction-amount">
                        ${formatMoney(
                            transaction.amount
                        )}
                    </strong>

                </div>


                <div class="transaction-details">

                    <span>
                        Charge:
                        ${formatMoney(
                            transaction.charge
                        )}
                    </span>

                    <span>•</span>

                    <span>
                        ${formatDateTime(
                            transaction.createdAt
                        )}
                    </span>

                </div>


                ${
                    transaction.note
                        ? `
                            <div class="transaction-note">
                                ${escapeHtml(
                                    transaction.note
                                )}
                            </div>
                        `
                        : ""
                }


                <div class="transaction-actions">

                    <button
                        class="transaction-action"
                        type="button"
                        data-action="edit"
                        data-id="${transaction.id}"
                    >
                        Edit
                    </button>

                    <button
                        class="transaction-action delete"
                        type="button"
                        data-action="delete"
                        data-id="${transaction.id}"
                    >
                        Delete
                    </button>

                </div>

            `;


            list.appendChild(card);

        }
    );

}


/* =========================================================
   27. EDIT TRANSACTION
   ========================================================= */

async function editTransaction(id) {

    const transaction =
        await getRecord(
            TRANSACTION_STORE,
            Number(id)
        );


    if (!transaction) {

        showToast(
            "Transaction not found."
        );

        return;

    }


    if (
        !currentDay ||
        transaction.dayId !==
        currentDay.id
    ) {

        showToast(
            "This transaction is not from today's record."
        );

        return;

    }


    if (
        currentDay.status !== "open"
    ) {

        showToast(
            "Closed records cannot be edited."
        );

        return;

    }


    currentEditingTransactionId =
        transaction.id;


    selectedTransactionType =
        transaction.type;


    $$(".type-button").forEach(
        (button) => {

            button.classList.toggle(
                "active",
                button.dataset.type ===
                transaction.type
            );

        }
    );


    $("transactionAmount").value =
        transaction.amount;


    $("transactionCharge").value =
        transaction.charge;


    $("transactionNote").value =
        transaction.note || "";


    $("saveTransactionBtn")
        .textContent =
        `Update Receipt ${transaction.receiptNumber}`;


    showScreen("transaction");


    setTimeout(
        () => {
            $("transactionAmount")
                .focus();
        },
        100
    );

}


/* =========================================================
   28. DELETE TRANSACTION
   ========================================================= */

function requestDeleteTransaction(id) {

    const transactionId =
        Number(id);


    showConfirmation(
        "Delete Transaction",
        "Are you sure you want to delete this transaction? This action cannot be undone.",
        "Delete",
        async () => {

            try {

                const transaction =
                    await getRecord(
                        TRANSACTION_STORE,
                        transactionId
                    );


                if (!transaction) {

                    showToast(
                        "Transaction not found."
                    );

                    return;

                }


                await deleteRecord(
                    TRANSACTION_STORE,
                    transactionId
                );


                await renderDashboard();

                await renderTransactions();


                showToast(
                    `Receipt ${transaction.receiptNumber} deleted.`
                );

            } catch (error) {

                console.error(error);

                showToast(
                    "Unable to delete transaction."
                );

            }

        }
    );

}


/* =========================================================
   29. RENDER HISTORY
   ========================================================= */

async function renderHistory() {

    const days =
        await getAllRecords(
            DAY_STORE
        );


    days.sort(
        (a, b) =>
            new Date(b.startedAt) -
            new Date(a.startedAt)
    );


    const list =
        $("historyList");


    list.innerHTML =
        "";


    $("emptyHistory")
        .classList.toggle(
            "hidden",
            days.length !== 0
        );


    for (
        const day of days
    ) {

        const transactions =
            await getDayTransactions(
                day.id
            );


        const totalCharges =
            transactions.reduce(
                (total, transaction) =>
                    total +
                    Number(
                        transaction.charge
                    ),

                0
            );


        const card =
            document.createElement(
                "div"
            );


        card.className =
            "history-card";


        card.innerHTML = `

            <div class="history-card-top">

                <span class="history-date">
                    ${formatDate(
                        day.startedAt
                    )}
                </span>

                <span class="history-status ${
                    day.status
                }">
                    ${
                        day.status === "closed"
                            ? "CLOSED"
                            : "OPEN"
                    }
                </span>

            </div>


            <div class="history-meta">

                <div class="history-stat">

                    <span>
                        Transactions
                    </span>

                    <strong>
                        ${transactions.length}
                    </strong>

                </div>


                <div class="history-stat">

                    <span>
                        Charges
                    </span>

                    <strong>
                        ${formatMoney(
                            totalCharges
                        )}
                    </strong>

                </div>


                <div class="history-stat">

                    <span>
                        Started
                    </span>

                    <strong>
                        ${formatTime(
                            day.startedAt
                        )}
                    </strong>

                </div>

            </div>

        `;


        card.addEventListener(
            "click",
            () => {

                renderDailyReport(
                    day.id
                );

            }
        );


        list.appendChild(card);

    }

}


/* =========================================================
   30. RENDER DAILY REPORT
   ========================================================= */

async function renderDailyReport(dayId) {

    const day =
        await getRecord(
            DAY_STORE,
            dayId
        );


    if (!day) {

        showToast(
            "Daily record not found."
        );

        return;

    }


    const transactions =
        await getDayTransactions(
            day.id
        );


    $("reportDate")
        .textContent =
        formatDate(
            day.startedAt
        );


    const totalCharges =
        transactions.reduce(
            (total, transaction) =>
                total +
                Number(
                    transaction.charge
                ),

            0
        );


    const withdrawalTotal =
        transactions

            .filter(
                (t) =>
                    t.type ===
                    "withdrawal"
            )

            .reduce(
                (total, t) =>
                    total +
                    Number(t.amount),

                0
            );


    const transferTotal =
        transactions

            .filter(
                (t) =>
                    t.type ===
                    "transfer"
            )

            .reduce(
                (total, t) =>
                    total +
                    Number(t.amount),

                0
            );


    const depositTotal =
        transactions

            .filter(
                (t) =>
                    t.type ===
                    "deposit"
            )

            .reduce(
                (total, t) =>
                    total +
                    Number(t.amount),

                0
            );


    const othersTotal =
        transactions

            .filter(
                (t) =>
                    t.type ===
                    "others"
            )

            .reduce(
                (total, t) =>
                    total +
                    Number(t.amount),

                0
            );


    const report =
        $("dailyReport");


    report.innerHTML = `

        <!-- DAY INFORMATION -->

        <div class="report-section">

            <div class="report-section-title">
                Day Information
            </div>

            <div class="report-row">

                <span>
                    Date
                </span>

                <strong>
                    ${formatDate(
                        day.startedAt
                    )}
                </strong>

            </div>


            <div class="report-row">

                <span>
                    Started
                </span>

                <strong>
                    ${formatTime(
                        day.startedAt
                    )}
                </strong>

            </div>


            <div class="report-row">

                <span>
                    Status
                </span>

                <strong>
                    ${
                        day.status === "closed"
                            ? "CLOSED"
                            : "OPEN"
                    }
                </strong>

            </div>


            ${
                day.closedAt
                    ? `
                        <div class="report-row">

                            <span>
                                Closed
                            </span>

                            <strong>
                                ${formatTime(
                                    day.closedAt
                                )}
                            </strong>

                        </div>
                    `
                    : ""
            }

        </div>


        <!-- OPENING -->

        <div class="report-section">

            <div class="report-section-title">
                Opening Record
            </div>

            <div class="report-row">

                <span>
                    Opening Cash
                </span>

                <strong>
                    ${formatMoney(
                        day.openingCash
                    )}
                </strong>

            </div>


            <div class="report-row">

                <span>
                    Opening POS
                </span>

                <strong>
                    ${formatMoney(
                        day.openingPos
                    )}
                </strong>

            </div>


            <div class="report-row">

                <span>
                    Opening Total
                </span>

                <strong class="report-total">
                    ${formatMoney(
                        day.openingTotal
                    )}
                </strong>

            </div>

        </div>


        <!-- SUMMARY -->

        <div class="report-section">

            <div class="report-section-title">
                Transaction Summary
            </div>

            <div class="report-row">

                <span>
                    Total Transactions
                </span>

                <strong>
                    ${transactions.length}
                </strong>

            </div>


            <div class="report-row">

                <span>
                    Withdrawal
                </span>

                <strong>
                    ${formatMoney(
                        withdrawalTotal
                    )}
                </strong>

            </div>


            <div class="report-row">

                <span>
                    Transfer
                </span>

                <strong>
                    ${formatMoney(
                        transferTotal
                    )}
                </strong>

            </div>


            <div class="report-row">

                <span>
                    Deposit
                </span>

                <strong>
                    ${formatMoney(
                        depositTotal
                    )}
                </strong>

            </div>


            <div class="report-row">

                <span>
                    Others
                </span>

                <strong>
                    ${formatMoney(
                        othersTotal
                    )}
                </strong>

            </div>


            <div class="report-row">

                <span>
                    Total Charges
                </span>

                <strong class="report-total">
                    ${formatMoney(
                        totalCharges
                    )}
                </strong>

            </div>

        </div>


        <!-- TRANSACTIONS -->

        <div class="report-section">

            <div class="report-section-title">
                My Transactions
            </div>


            ${
                transactions.length === 0
                    ? `
                        <p
                            style="
                                color: var(--text-muted);
                                font-size: 12px;
                            "
                        >
                            No transactions recorded.
                        </p>
                    `
                    : transactions

                        .slice()
                        .sort(
                            (a, b) =>
                                Number(
                                    a.receiptNumber
                                ) -
                                Number(
                                    b.receiptNumber
                                )
                        )

                        .map(
                            (transaction) => `

                                <div class="report-transaction">

                                    <div class="report-transaction-top">

                                        <strong>
                                            #${escapeHtml(
                                                transaction.receiptNumber
                                            )}
                                            —
                                            ${escapeHtml(
                                                transaction.type
                                            )}
                                        </strong>

                                        <strong>
                                            ${formatMoney(
                                                transaction.amount
                                            )}
                                        </strong>

                                    </div>

                                    <small>
                                        Charge:
                                        ${formatMoney(
                                            transaction.charge
                                        )}
                                        •
                                        ${formatDateTime(
                                            transaction.createdAt
                                        )}
                                    </small>

                                    ${
                                        transaction.note
                                            ? `
                                                <small>
                                                    Note:
                                                    ${escapeHtml(
                                                        transaction.note
                                                    )}
                                                </small>
                                            `
                                            : ""
                                    }

                                </div>

                            `
                        )
                        .join("")
            }

        </div>


        <!-- CLOSING -->

        ${
            day.status === "closed"
                ? `

                    <div class="report-section">

                        <div class="report-section-title">
                            Closing Record
                        </div>

                        <div class="report-row">

                            <span>
                                Closing Cash
                            </span>

                            <strong>
                                ${formatMoney(
                                    day.closingCash
                                )}
                            </strong>

                        </div>


                        <div class="report-row">

                            <span>
                                Closing POS
                            </span>

                            <strong>
                                ${formatMoney(
                                    day.closingPos
                                )}
                            </strong>

                        </div>


                        <div class="report-row">

                            <span>
                                Closing Total
                            </span>

                            <strong class="report-total">
                                ${formatMoney(
                                    day.closingTotal
                                )}
                            </strong>

                        </div>

                    </div>

                `
                : ""
        }

    `;


    showScreen("report");

}


/* =========================================================
   31. OPEN END-DAY SCREEN
   ========================================================= */

function prepareEndDay() {

    if (!currentDay) {

        showToast(
            "There is no active working day."
        );

        return;

    }


    if (
        currentDay.status !== "open"
    ) {

        showToast(
            "This day is already closed."
        );

        return;

    }


    $("closingCash").value =
        "";

    $("closingPos").value =
        "";


    $("closingTotal")
        .textContent =
        formatMoney(0);


    showScreen("endDay");

}


/* =========================================================
   32. CLOSE DAY
   ========================================================= */

function requestCloseDay() {

    const cash =
        Number(
            $("closingCash").value
        );


    const pos =
        Number(
            $("closingPos").value
        );


    if (
        !Number.isFinite(cash) ||
        cash < 0
    ) {

        showToast(
            "Enter a valid closing cash amount."
        );

        $("closingCash").focus();

        return;

    }


    if (
        !Number.isFinite(pos) ||
        pos < 0
    ) {

        showToast(
            "Enter a valid closing POS balance."
        );

        $("closingPos").focus();

        return;

    }


    showConfirmation(
        "Close Working Day",
        "Once this day is closed, you will not be able to add or edit its transactions.",
        "Close Day",
        () => closeDay(
            cash,
            pos
        )
    );

}


/* =========================================================
   33. CLOSE DAY
   ========================================================= */

async function closeDay(
    closingCash,
    closingPos
) {

    if (!currentDay) {

        showToast(
            "No active working day."
        );

        return;

    }


    try {

        const now =
            new Date();


        currentDay.status =
            "closed";


        currentDay.closedAt =
            now.toISOString();


        currentDay.closingCash =
            closingCash;


        currentDay.closingPos =
            closingPos;


        currentDay.closingTotal =
            closingCash +
            closingPos;


        await updateRecord(
            DAY_STORE,
            currentDay
        );


        await renderDashboard();


        showScreen("dashboard");


        showToast(
            "Working day closed successfully."
        );


        /* Open daily report after a short delay */

        setTimeout(
            () => {

                renderDailyReport(
                    currentDay.id
                );

            },
            250
        );

    } catch (error) {

        console.error(error);

        showToast(
            "Unable to close the working day."
        );

    }

}


/* =========================================================
   34. CONFIRMATION MODAL
   ========================================================= */

function showConfirmation(
    title,
    message,
    confirmText,
    action
) {

    $("modalTitle")
        .textContent =
        title;


    $("modalMessage")
        .textContent =
        message;


    $("modalConfirmBtn")
        .textContent =
        confirmText;


    modalConfirmAction =
        action;


    $("modalOverlay")
        .classList.remove(
            "hidden"
        );

}


function hideConfirmation() {

    $("modalOverlay")
        .classList.add(
            "hidden"
        );


    modalConfirmAction =
        null;

}


/* =========================================================
   35. TOAST
   ========================================================= */

let toastTimer = null;


function showToast(message) {

    const toast =
        $("toast");


    $("toastMessage")
        .textContent =
        message;


    toast.classList.remove(
        "hidden"
    );


    clearTimeout(
        toastTimer
    );


    toastTimer =
        setTimeout(
            () => {

                toast.classList.add(
                    "hidden"
                );

            },
            3000
        );

}


/* =========================================================
   36. ESCAPE HTML
   ========================================================= */

function escapeHtml(value) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        String(value ?? "");


    return div.innerHTML;

}


/* =========================================================
   37. BACKUP DATA
   ========================================================= */

async function backupData() {

    try {

        const days =
            await getAllRecords(
                DAY_STORE
            );


        const transactions =
            await getAllRecords(
                TRANSACTION_STORE
            );


        const backup = {

            app:
                "Moniepoint Personal Record",

            version:
                1,

            exportedAt:
                new Date().toISOString(),

            days:
                days,

            transactions:
                transactions

        };


        const json =
            JSON.stringify(
                backup,
                null,
                2
            );


        const blob =
            new Blob(
                [json],
                {
                    type:
                        "application/json"
                }
            );


        const url =
            URL.createObjectURL(
                blob
            );


        const link =
            document.createElement(
                "a"
            );


        const date =
            getDateKey();


        link.href =
            url;


        link.download =
            `Moniepoint_Record_Backup_${date}.json`;


        document.body.appendChild(
            link
        );


        link.click();


        link.remove();


        URL.revokeObjectURL(
            url
        );


        showToast(
            "Backup created successfully."
        );

    } catch (error) {

        console.error(error);

        showToast(
            "Unable to create backup."
        );

    }

}


/* =========================================================
   38. RESTORE DATA
   ========================================================= */

async function restoreData(file) {

    if (!file) {
        return;
    }


    try {

        const text =
            await file.text();


        const backup =
            JSON.parse(text);


        if (
            backup.app !==
            "Moniepoint Personal Record"
        ) {

            showToast(
                "This is not a valid backup file."
            );

            return;

        }


        if (
            !Array.isArray(
                backup.days
            ) ||
            !Array.isArray(
                backup.transactions
            )
        ) {

            showToast(
                "The backup file is incomplete."
            );

            return;

        }


        showConfirmation(
            "Restore Backup",
            "Restoring this backup will replace the current records on this device. Continue?",
            "Restore",
            async () => {

                try {

                    await clearStore(
                        DAY_STORE
                    );


                    await clearStore(
                        TRANSACTION_STORE
                    );


                    for (
                        const day of backup.days
                    ) {

                        await addRecord(
                            DAY_STORE,
                            day
                        );

                    }


                    for (
                        const transaction of
                        backup.transactions
                    ) {

                        await addRecord(
                            TRANSACTION_STORE,
                            transaction
                        );

                    }


                    currentDay =
                        await getOpenDay();


                    if (currentDay) {

                        await renderDashboard();

                        showScreen(
                            "dashboard"
                        );

                    } else {

                        showScreen(
                            "startDay"
                        );

                    }


                    showToast(
                        "Backup restored successfully."
                    );

                } catch (error) {

                    console.error(error);

                    showToast(
                        "Unable to restore backup."
                    );

                }

            }
        );

    } catch (error) {

        console.error(error);

        showToast(
            "The backup file could not be read."
        );

    }

}


/* =========================================================
   39. CLEAR DATABASE STORE
   ========================================================= */

function clearStore(storeName) {

    return dbRequest(
        storeName,
        "readwrite",
        (store) => store.clear()
    );

}


/* =========================================================
   40. NAVIGATION EVENTS
   ========================================================= */

function setupNavigation() {


    /* New transaction */

    $("newTransactionBtn")
        .addEventListener(
            "click",
            prepareNewTransaction
        );


    $("emptyNewTransactionBtn")
        .addEventListener(
            "click",
            prepareNewTransaction
        );


    /* Transaction list */

    $("transactionsBtn")
        .addEventListener(
            "click",
            async () => {

                await renderTransactions();

                showScreen(
                    "transactions"
                );

            }
        );


    /* History */

    $("historyBtn")
        .addEventListener(
            "click",
            async () => {

                await renderHistory();

                showScreen(
                    "history"
                );

            }
        );


    /* End day */

    $("endDayBtn")
        .addEventListener(
            "click",
            prepareEndDay
        );


    /* Settings */

    $("settingsBtn")
        .addEventListener(
            "click",
            () => {

                showScreen(
                    "settings"
                );

            }
        );


    /* Back buttons */

    $("backFromTransactionBtn")
        .addEventListener(
            "click",
            () => {

                currentEditingTransactionId =
                    null;

                showScreen(
                    "dashboard"
                );

            }
        );


    $("backFromTransactionsBtn")
        .addEventListener(
            "click",
            () => {

                showScreen(
                    "dashboard"
                );

            }
        );


    $("backFromHistoryBtn")
        .addEventListener(
            "click",
            () => {

                showScreen(
                    "dashboard"
                );

            }
        );


    $("backFromReportBtn")
        .addEventListener(
            "click",
            () => {

                showScreen(
                    "history"
                );

            }
        );


    $("backFromSettingsBtn")
        .addEventListener(
            "click",
            () => {

                showScreen(
                    "dashboard"
                );

            }
        );


    $("cancelEndDayBtn")
        .addEventListener(
            "click",
            () => {

                showScreen(
                    "dashboard"
                );

            }
        );


    /* Bottom navigation */

    $$(".nav-item").forEach(
        (item) => {

            item.addEventListener(
                "click",
                async () => {

                    const screen =
                        item.dataset.screen;


                    if (
                        screen ===
                        "dashboard"
                    ) {

                        await renderDashboard();

                        showScreen(
                            "dashboard"
                        );

                    }


                    if (
                        screen ===
                        "transactions"
                    ) {

                        await renderTransactions();

                        showScreen(
                            "transactions"
                        );

                    }


                    if (
                        screen ===
                        "history"
                    ) {

                        await renderHistory();

                        showScreen(
                            "history"
                        );

                    }


                    if (
                        screen ===
                        "settings"
                    ) {

                        showScreen(
                            "settings"
                        );

                    }

                }
            );

        }
    );


    const navAddButton =
    document.querySelector(".nav-add");

if (navAddButton) {
    navAddButton.addEventListener(
        "click",
        prepareNewTransaction
    );
}

}


/* =========================================================
   41. FORM EVENTS
   ========================================================= */

function setupFormEvents() {


    /* Opening totals */

    $("openingCash")
        .addEventListener(
            "input",
            updateOpeningTotal
        );


    $("openingPos")
        .addEventListener(
            "input",
            updateOpeningTotal
        );


    /* Closing totals */

    $("closingCash")
        .addEventListener(
            "input",
            updateClosingTotal
        );


    $("closingPos")
        .addEventListener(
            "input",
            updateClosingTotal
        );


    /* Start day */

    $("startDayBtn")
        .addEventListener(
            "click",
            startNewDay
        );


    /* Save transaction */

    $("saveTransactionBtn")
        .addEventListener(
            "click",
            saveTransaction
        );


    /* Close day */

    $("confirmEndDayBtn")
        .addEventListener(
            "click",
            requestCloseDay
        );


    /* Transaction type */

    $$(".type-button").forEach(
        (button) => {

            button.addEventListener(
                "click",
                () => {

                    selectedTransactionType =
                        button.dataset.type;


                    $$(".type-button")
                        .forEach(
                            (item) => {

                                item.classList.toggle(
                                    "active",
                                    item ===
                                    button
                                );

                            }
                        );

                }
            );

        }
    );


    /* Search */

    $("transactionSearch")
        .addEventListener(
            "input",
            renderTransactions
        );


    /* Transaction filters */

    $$(".filter-button").forEach(
        (button) => {

            button.addEventListener(
                "click",
                async () => {

                    selectedTransactionFilter =
                        button.dataset.filter;


                    $$(".filter-button")
                        .forEach(
                            (item) => {

                                item.classList.toggle(
                                    "active",
                                    item ===
                                    button
                                );

                            }
                        );


                    await renderTransactions();

                }
            );

        }
    );


    /* Transaction actions */

    $("transactionList")
        .addEventListener(
            "click",
            (event) => {

                const button =
                    event.target.closest(
                        "[data-action]"
                    );


                if (!button) {
                    return;
                }


                const action =
                    button.dataset.action;


                const id =
                    button.dataset.id;


                if (
                    action ===
                    "edit"
                ) {

                    editTransaction(id);

                }


                if (
                    action ===
                    "delete"
                ) {

                    requestDeleteTransaction(
                        id
                    );

                }

            }
        );


    


/* =========================================================
   42. MODAL EVENTS
   ========================================================= */

function setupModalEvents() {

    $("modalCancelBtn")
        .addEventListener(
            "click",
            hideConfirmation
        );


    $("modalConfirmBtn")
        .addEventListener(
            "click",
            async () => {

                const action =
                    modalConfirmAction;


                hideConfirmation();


                if (
                    typeof action ===
                    "function"
                ) {

                    await action();

                }

            }
        );


    $("modalOverlay")
        .addEventListener(
            "click",
            (event) => {

                if (
                    event.target ===
                    $("modalOverlay")
                ) {

                    hideConfirmation();

                }

            }
        );

}


/* =========================================================
   43. SETTINGS EVENTS
   ========================================================= */

function setupSettingsEvents() {


    $("backupBtn")
        .addEventListener(
            "click",
            backupData
        );


    $("restoreBtn")
        .addEventListener(
            "click",
            () => {

                $("restoreFileInput")
                    .click();

            }
        );


    $("restoreFileInput")
        .addEventListener(
            "change",
            async (event) => {

                const file =
                    event.target.files[0];


                if (file) {

                    await restoreData(
                        file
                    );

                }


                event.target.value =
                    "";

            }
        );


    $("exportReportBtn")
        .addEventListener(
            "click",
            exportCurrentReport
        );

}


/* =========================================================
   44. EXPORT CURRENT REPORT
   ========================================================= */

async function exportCurrentReport() {

    const reportText =
        $("dailyReport")
            .innerText
            .trim();


    if (!reportText) {

        showToast(
            "There is no report to export."
        );

        return;

    }


    const blob =
        new Blob(
            [reportText],
            {
                type:
                    "text/plain;charset=utf-8"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement(
            "a"
        );


    link.href =
        url;


    link.download =
        `Daily_Report_${getDateKey()}.txt`;


    document.body.appendChild(
        link
    );


    link.click();


    link.remove();


    URL.revokeObjectURL(
        url
    );


    showToast(
        "Daily report exported."
    );

}


/* =========================================================
   45. INITIAL APPLICATION START
   ========================================================= */

async function initializeApp() {

    try {

        await openDatabase();


        currentDay =
            await getOpenDay();


        setupNavigation();

        setupFormEvents();

        setupModalEvents();

        setupSettingsEvents();


        if (currentDay) {

            await renderDashboard();

            showScreen(
                "dashboard"
            );

        } else {

            showScreen(
                "startDay"
            );

        }

    } catch (error) {

        console.error(
            "Application initialization failed:",
            error
        );


        showToast(
            "Unable to initialize the application."
        );

    }

}


/* =========================================================
   46. SERVICE WORKER REGISTRATION
   ========================================================= */

if (
    "serviceWorker" in navigator
) {

    window.addEventListener(
        "load",
        () => {

            navigator.serviceWorker
                .register("sw.js")
                .then(
                    () => {

                        console.log(
                            "Service worker registered."
                        );

                    }
                )
                .catch(
                    (error) => {

                        console.warn(
                            "Service worker registration failed:",
                            error
                        );

                    }
                );

        }
    );

}


/* =========================================================
   47. START APPLICATION
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initializeApp
);