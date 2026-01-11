function sendData() {

    $("#overlay").fadeIn(300);
    // フォーム要素をIDで取得
    const form = document.getElementById('answer-form');

    // フォームの入力値を検証
    if (!form.checkValidity()) {
        // 検証が失敗した場合、中断
        $("#overlay").fadeOut(300);
        // 失敗時のトースト表示
        document.getElementsByName('ANSWER').forEach(element => {
            element.checked = false;
        });
        const toast = new bootstrap.Toast($('#toast-failed'));
        toast.show();
        return;
    }

    // フォームデータを取得
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries()); // オブジェクト形式に変換

    $.ajax({
        url: 'php/send_data.php',
        data: data,
        method: 'POST'
    }).done(function (response) {
        try {
            const data = JSON.parse(response); // サーバー応答をパース
            console.log(data);
            //sendMessage()

            // 成功時のトースト表示
            //const toast = new bootstrap.Toast($('#toast-done'));
            //toast.show();

            // モーダルの表示
            const myModalAlternative = new bootstrap.Modal('#resultModal');
            myModalAlternative.show();

            // 送信ボタンを無効化
            const $submitButton = $('#answer-form').find('button[type="submit"], input[type="submit"]');
            $submitButton.prop('disabled', true).text('送信しました');

            // 結果の表示 (HTMLエスケープ処理)
            $('#USERNAME_RESULT').html(escapeHTML(data[3]));
            $('#LOCATIONS_RESULT').html(escapeHTML(data[2]));
            $('#SETID_RESULT').html(escapeHTML(data[0]));
            $('#QUESTIONID_RESULT').html(escapeHTML(data[1]) == 0 ? 'テスト' : Number(data[1]) + '問目');
            $('#ANSWER_RESULT').html(escapeHTML(data[4]) == 'SET_START' ? '問題開始' : escapeHTML(data[4]));
            $('#ANSWERTIME_RESULT').html(data[5].replaceAll('-', '/'));
            $('#ANSWERSPEED_RESULT').html(data[6].toFixed(3) + ' 秒');

            $("#overlay").fadeOut(300);
        } catch (e) {
            console.error('サーバー応答の解析に失敗しました。', e);
            $("#overlay").fadeOut(300);
            // 失敗時のトースト表示
            const toast = new bootstrap.Toast($('#toast-failed'));
            toast.show();
        };
    }).fail(function (XMLHttpRequest, status, e) {
        console.error('通信エラー', XMLHttpRequest, status, e);

        $("#overlay").fadeOut(300);
        // 受付時間外のトースト表示
        const toast = new bootstrap.Toast($('#toast-outside'));
        toast.show();
    });
};

$(function () {

    $('#answer-form').on('submit', function () {
        const $submitButton = $(this).find('button[type="submit"], input[type="submit"]');
        $submitButton.prop('disabled', true).text('送信中...');
    });

    $('#result-close').on('click', function () {
        const $submitButton = $('#answer-form').find('button[type="submit"], input[type="submit"]');
        $submitButton.prop('disabled', false).text('解答を送信する');

        // 初期状態を空欄に設定
        document.getElementById('QUESTIONID').value = '';

        // 現在のURLを取得
        const url = new URL(window.location.href);
        // URLSearchParamsを使う
        const params = new URLSearchParams(url.search);
        // 'type' パラメータを取得
        const type = params.get('type');

        if (type == 0) {
            document.getElementById('ANSWER').value = 'SET_START';
        } else {
            document.getElementById('ANSWER').value = '';
        };

        document.getElementsByName('ANSWER').forEach(element => {
            element.checked = false;
        });

        // 結果の表示
        $('#USERNAME_RESULT').text('NO DATA');
        $('#LOCATIONS_RESULT').text('NO DATA');
        $('#SETID_RESULT').text('NO DATA');
        $('#QUESTIONID_RESULT').text('NO DATA');
        $('#ANSWER_RESULT').text('NO DATA');
        $('#ANSWERTIME_RESULT').text('NO DATA');
        $('#ANSWERSPEED_RESULT').text('NO DATA');
    });

});
