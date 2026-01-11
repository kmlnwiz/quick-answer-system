let ans_data;
let checkedANSWERID = [];

function outputTable(array) {

    let html = '';
    array.forEach((element, index) => {

        if (escapeHTML(element.ANSWER) == 'SET_START') {
            html += `<tr class="table-secondary border-2">`;
        } else {
            html += `<tr>`;
        };
        html += `<th class="text-center align-content-center"><input class="form-check-input" type="checkbox" onClick="cast(event, ${element.ANSWERID})" ${element.ANSWER == 'SET_START' ? 'disabled' : ''} ${checkedANSWERID.indexOf(Number(element.ANSWERID)) != -1 ? 'checked' : ''}></th>`;
        html += `<th class="text-center align-content-center">${element.ANSWERTIME.replaceAll('-', '/')}</th>`;
        html += `<td class="text-center align-content-center">${String(element.SETID).padStart(4, '0')}</td>`;
        html += `<td class="text-center align-content-center">${Number(element.QUESTIONID) == 0 ? 'テスト' : Number(element.QUESTIONID) + '問目'}</td>`;
        html += `<td class="text-center align-content-center">${escapeHTML(element.LOCATIONS)}</td>`;
        html += `<td class="text-center align-content-center">${escapeHTML(element.USERNAME)}</td>`;
        html += `<td class="text-center align-content-center">${escapeHTML(element.ANSWER) == 'SET_START' ? '問題開始' : escapeHTML(element.ANSWER)}</td>`;
        html += `<td class="text-end align-content-center">${escapeHTML(element.ANSWER) == 'SET_START' ? '0.000' : element.ANSWERSPEED.toFixed(3)} 秒</td>`;
        html += `</tr>`;
    });

    $(`#data`).html(html);
};

function tableFilter(ans_data) {

    function filter(array) {
        const selectedDate = document.getElementById('speed-date').value; // 選択した日付を取得
        const selectedSetId = document.getElementById('speed-setid').value.toUpperCase(); // 入力したセット番号を取得
        const selectedQuestionId = document.getElementById('speed-questionid').value; // 選択した問題番号を取得

        if (selectedDate) {
            const selectedDateObj = new Date(selectedDate); // 選択した日付を Date オブジェクトに変換

            array = array.filter(item => {
                // 各タイムスタンプを Date オブジェクトに変換
                const itemDate = new Date(item.ANSWERTIME);

                // 年月日を比較（タイムゾーンを考慮）
                return (
                    itemDate.getFullYear() === selectedDateObj.getFullYear() &&
                    itemDate.getMonth() === selectedDateObj.getMonth() &&
                    itemDate.getDate() === selectedDateObj.getDate()
                );
            });

        } else {
            array = array;
        };

        if (selectedSetId) {
            const selectedSetIdObj = Number(selectedSetId);
            array = array.filter(item => {
                const itemSetId = Number(item.SETID);
                return itemSetId === selectedSetIdObj;
            });
        } else {
            array = array;
        };

        if (selectedQuestionId) {
            const selectedQuestionIdObj = Number(selectedQuestionId);
            array = array.filter(item => {
                const itemQuestionId = Number(item.QUESTIONID);
                return itemQuestionId === selectedQuestionIdObj;
            });
        } else {
            array = array;
        };

        array.sort((a, b) => {
            // 1. SETIDを16進数として数値に変換して比較
            const setIdDiff = parseInt(a.SETID, 16) - parseInt(b.SETID, 16);
            if (setIdDiff !== 0) return setIdDiff;

            // 2. QUESTIONIDを比較
            const questionIdDiff = a.QUESTIONID - b.QUESTIONID;
            if (questionIdDiff !== 0) return questionIdDiff;

            // 3. ANSWERSPEEDを比較
            return a.ANSWERSPEED - b.ANSWERSPEED;
        });

        outputTable(array);
    };

    filter(ans_data);
};

//データの取得
$(function () {
    $("#overlay").fadeIn(300);

    fetch('php/data.php')
        .then(response => response.json())
        .then(data => {
            ans_data = data;
            console.log(ans_data);
            tableFilter(ans_data);

            $("#overlay").fadeOut(300);
        })
        .catch(error => {
            console.error('Error:', error);

            $("#overlay").fadeOut(300);
        });
    dataMonitor();
});

//データの追加取得
function dataMonitor() {
    setInterval(() => {
        fetch('php/data.php')
            .then(response => response.json())
            .then(data => {
                // 新規取得したデータが今のデータと同じかどうかをチェック
                if (JSON.stringify(data) !== JSON.stringify(ans_data)) {
                    ans_data = data;
                    tableFilter(ans_data);
                }
            })
            .catch(error => {
                console.error('Error:', error);
            });
    }, 3000);
};

/* ---------- */

function point_data() {
    const maxPoint = Number($('#max-point').val());
    const minPoint = Number($('#min-point').val());
    const step = Number($('#step').val());

    // 他のクライアントにデータを送信
    const channel = new BroadcastChannel('shared-channel');
    channel.postMessage({ type: 'point', payload: [maxPoint, minPoint, step] });
    console.log('Data sent (point):', [maxPoint, minPoint, step]);
};

/* ---------- */

function cast(event, ANSWERID) {
    const checkbox = $(event.target); // イベントターゲット（クリックされたチェックボックス）

    // チェックボックスがオンのときだけ処理を行う
    if (checkbox.prop('checked')) {
        // data配列内でANSWERIDが一致するインデックスを取得
        const index = ans_data.findIndex(element => element.ANSWERID == ANSWERID);

        if (index !== -1) { // 見つかった場合のみ処理
            checkedANSWERID.push(ANSWERID);
            const channel = new BroadcastChannel('shared-channel');
            const AnswerData = ans_data[index]; // 該当データを取得

            // 他のクライアントにデータを送信
            channel.postMessage({ type: 'add', payload: AnswerData });
            console.log('Data sent (add):', AnswerData);

            // トーストを表示（コメントアウトされている部分）
            // const toast = new bootstrap.Toast($('#toast-cast'));
            // toast.show();
        };
    } else {
        // data配列内でANSWERIDが一致するインデックスを取得
        const index = ans_data.findIndex(element => element.ANSWERID == ANSWERID);

        if (index !== -1) { // 見つかった場合のみ処理
            checkedANSWERID = checkedANSWERID.filter(item => item != ANSWERID);
            console.log(index, checkedANSWERID);
            const channel = new BroadcastChannel('shared-channel');
            const AnswerData = ans_data[index]; // 該当データを取得

            // 他のクライアントにデータを送信
            channel.postMessage({ type: 'deleteOne', payload: AnswerData });
            console.log('Data sent (deketeOne):', AnswerData);

            // トーストを表示（コメントアウトされている部分）
            // const toast = new bootstrap.Toast($('#toast-cast'));
            // toast.show();
        };
    };
};

function castReset() {
    const channel = new BroadcastChannel('shared-channel');
    // 他のクライアントにデータを送信
    channel.postMessage({ type: 'deleteAll', payload: '' });
    console.log('deleteAll');

    // すべてのチェックボックスのチェックを外す
    $('input[type="checkbox"]').prop('checked', false);
    checkedANSWERID.length = 0;
};

function checkAll() {
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');

    checkboxes.forEach((checkbox) => {
        if (!checkbox.disabled && !checkbox.checked) {
            checkbox.click();
        }
    });
};
