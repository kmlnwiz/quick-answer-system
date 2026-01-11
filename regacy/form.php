<?php session_start();
$type = isset(($_GET['type'])) ? htmlspecialchars($_GET['type']) : 1;
$option = isset(($_GET['option'])) ? htmlspecialchars($_GET['option']) : 4;
//$set = isset(($_GET['set'])) ? htmlspecialchars($_GET['set']) : '';

if($type == 0){
    require('../dbconnect.php');
    require('../islogin.php');
}
?>

<!DOCTYPE html>
<html lang="ja" class="" data-bs-theme="light">

<head>
    <meta charset="UTF-8" />
    <meta http-equiv="content-language" content="ja">
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex">
    <meta http-equiv="Cache-Control" content="no-cache">
    <link rel="apple-touch-icon" href="https://fromtheasia.com/wp-content/uploads/NCG162-2-140x140.jpg">
    <title>解答フォーム</title>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.2.0-beta1/dist/js/bootstrap.bundle.min.js" integrity="sha384-pprn3073KE6tl6bjs2QrFaJGz5/SUsLqktiwsUTF55Jfv3qYSDhgCecCxMW52nD2" crossorigin="anonymous"></script>
    <link rel="stylesheet" href="../css/bootstrap.css" crossorigin="anonymous">
    <link rel="stylesheet" href="../css/style.css" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.7.1/font/bootstrap-icons.css">
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.4.1/jquery.min.js"></script>
    <script src="js/form.js"></script>
    <script src="../js/tool.js"></script>
    <script>
        document.addEventListener("dblclick", function (e) {
            e.preventDefault();
        }, {
            passive: false
        });
    </script>
    <script>
        $(function () {
            //スクロール
            $('#pagetop').click(function () {
                //id名#pagetopがクリックされたら、以下の処理を実行
                $("html,body").animate({
                    scrollTop: 0
                }, 0, 200);
            });
            $('#pagebottom').click(function () {
                //id名#pagetopがクリックされたら、以下の処理を実行
                $("html,body").animate({
                    scrollTop: $(document).height()
                }, 0, 200);
            });
        });
    </script>
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/1.11.1/jquery.min.js"></script>
    <script>
        $(function () {
            var h = $(window).height();

            $('#wrap').css('display', 'none');
            $('#loader-bg ,#loader-light,#loader-dark').height(h).css('display', 'block');
        });

        $(window).load(function () { //全ての読み込みが完了したら実行
            $('#loader-bg').delay(200).fadeOut(200);
            $('#loader-light', '#loader-dark').delay(200).fadeOut(200);
            $('#wrap').css('display', 'block');
        });
    </script>
    <script>
  (function() {
    const savedTheme = localStorage.getItem('shikimel_tools_theme');
    if (savedTheme) {
      const theme = JSON.parse(savedTheme);
      document.documentElement.setAttribute('data-bs-theme', theme);
    }
  })();
</script>
</head>

<body class="d-flex flex-column touch-none <?php echo ($type != 0) ? 'default-font' : ''; ?>">

    <?php require('../component/loading.php'); ?>

    <?php if($type == 0):?>
        <?php require('../component/header.php'); ?>
    <?php else: ?>
        <nav class="navbar navbar-light bg-body-secondary touch-none" style="height: 51px;">
            <span class="navbar-brand mb-0 px-3 h1 py-1">
                <i class="bi bi-house-door-fill "></i>
        ShikimelTools
        </span>
        </nav>
    <?php endif;?>

    <main class="flex-shrink-0">
        <div id="Content" class="container-fluid bg-body" style="margin-bottom: 67px!important;">
            <div class="row my-2">

                <div class="col-12 mx-auto">
                    <span class="border-bottom h1 d-block py-2 mb-2 touch-none">解答フォーム</span>

                    <div class="card touch-none">
                        <div class="card-body overflow-hidden">
                            <form id="answer-form" class="was-validated">

                                <div class="row g-0 gx-2">
                                    <div class="col-6 mb-4">
                                        <label for="USERNAME" class="form-label h4 <?php echo ($type != 0) ? 'fw-bold' : ''; ?>"><span class="text-danger">*</span>名前</label>
                                        <input type="text" class="form-control form-control-lg" name="USERNAME" id="USERNAME" value="<?php echo ($type == 0) ? 'Shikimel' : ''; ?>" required>
                                    </div>

                                    <div class="col-6 mb-4">
                                        <label for="LOCATIONS" class="form-label h4 <?php echo ($type != 0) ? 'fw-bold' : ''; ?>"><span class="text-danger">*</span>実施店舗</label>
                                        <select class="form-select form-select-lg" name="LOCATIONS" id="LOCATIONS" value="" required>
                                            <option value="" selected disabled>実施店舗を選択してください</option>
                                            <option value="池袋">池袋</option>
                                            <option value="名古屋">名古屋</option>
                                            <option value="大阪">大阪</option>
                                            <option value="秋葉原">秋葉原</option>
                                        </select>
                                    </div>
                                </div>

                                <hr>

                                <div class="row g-0 gx-2">
                                    <div class="col-6 mb-4">
                                        <label for="SETID" class="form-label h4 <?php echo ($type != 0) ? 'fw-bold' : ''; ?>"><span class="text-danger">*</span>セット番号</label>
                                        <input type="number" class="form-control form-control-lg" name="SETID" id="SETID" value="<?php //echo ($set == '') ? '' : $set; ?>" required>
                                    </div>
                                    <div class="col-6 mb-4">
                                        <label for="QUESTIONID" class="form-label h4 <?php echo ($type != 0) ? 'fw-bold' : ''; ?>"><span class="text-danger">*</span>問題番号</label>
                                        <select class="form-select form-select-lg" name="QUESTIONID" id="QUESTIONID" value="" required>
                                            <option value="" selected disabled>問題番号を選択してください</option>
                                            <option value="0">テスト</option>
                                            <hr>
                                            <option value="1">1問目</option>
                                            <option value="2">2問目</option>
                                            <option value="3">3問目</option>
                                            <option value="4">4問目</option>
                                            <option value="5">5問目</option>
                                            <option value="6">6問目</option>
                                            <option value="7">7問目</option>
                                            <option value="8">8問目</option>
                                            <option value="9">9問目</option>
                                            <option value="10">10問目</option>
                                        </select>
                                    </div>
                                </div>

                                <hr>

                                <?php if($type == 0): ?>

                                    <label for="ANSWER" class="form-label h4"><span class="text-danger">*</span>条件を選択してください</label>
                                    <div class="row gx-2">
                                        <div class="col">
                                            <input type="radio" class="btn-check" name="ANSWER" id="ANSWER" value="SET_START" onClick="sendData()">
                                            <label class="btn btn-lg btn-outline-indigo text-center" for="ANSWER">解答受付を開始する<small>（5分間有効）</small></label>
                                        </div>
                                        <!--<div class="col">
                                            <input type="radio" class="btn-check" name="ANSWER" id="option2" value="SET_FINISH" onClick="sendData()">
                                            <label class="btn btn-lg btn-outline-indigo w-100 text-center py-2 fs-1" for="option2">終了</label>
                                        </div>-->
                                    </div>

                                <?php elseif($type == 2) :?>

                                    <div class="mb-4">
                                        <label for="ANSWER" class="form-label h4 <?php echo ($type != 0) ? 'fw-bold' : ''; ?>"><span class="text-danger">*</span>解答を選択してください</label>

                                        <div class="row row-cols-4 row-cols-lg-5 gx-2 gy-2">
                                            <?php for ($i=0; $i < $option && $i < 26; $i++):?>
                                            <div class="col">
                                                <input type="radio" class="btn-check" name="ANSWER" id="option<?php echo ($i + 1);?>" value="<?php echo chr(65 + $i); ?>">
                                                <label class="btn btn-lg btn-outline-indigo w-100 text-center py-3 fs-1 <?php echo ($type != 0) ? 'fw-bold' : ''; ?>" for="option<?php echo ($i + 1);?>"><?php echo chr(65 + $i); ?></label>
                                            </div>
                                            <?php endfor; ?>
                                        </div>
                                    </div>

                                    <?php else: ?>

                                        <div class="mb-4">
                                        <label for="ANSWER" class="form-label h4 <?php echo ($type != 0) ? 'fw-bold' : ''; ?>"><span class="text-danger">*</span>解答を入力してください</label>
                                        <input type="text" class="form-control form-control-lg" name="ANSWER" id="ANSWER" value="<?php echo ($type == 0) ? 'SET_START' : ''; ?>" required>
                                    </div>

                                    <?php endif; ?>

                                    <?php if($type != 0) :?>
                                        <button type="button" class="btn btn-outline-indigo btn-lg <?php echo ($type != 0) ? 'fw-bold' : ''; ?>" onClick="sendData()">解答を送信する</button>
                                    <?php endif; ?>

                            </form>
                        </div>
                    </div>


                </div>
            </div>

        </div>

        <div id="resultModal" class="modal fade" tabindex="-1">
          <div class="modal-dialog modal-fullscreen">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title"><h1>解答結果</h1></h5>
              </div>

              <div class="modal-body">
                <div class="mb-4">
                    <label for="USERNAME_RESULT" class="form-label h4 py-1 bg-indigo text-center text-white rounded <?php echo ($type != 0) ? 'fw-bold' : ''; ?>" style="width:8.00em;">名前</label>
                    <div class="h4"><span id="USERNAME_RESULT">NO DATA</span></div>
                </div>

                <div class="mb-4">
                    <label for="LOCATIONS_RESULT" class="form-label h4 py-1 bg-secondary text-center text-white rounded <?php echo ($type != 0) ? 'fw-bold' : ''; ?>" style="width:8.00em;">実施店舗</label>
                    <div class="h4"><span id="LOCATIONS_RESULT">NO DATA</span></div>
                </div>

                <div class="mb-4">
                    <label for="SETID_RESULT" class="form-label h4 py-1 bg-secondary text-center text-white rounded <?php echo ($type != 0) ? 'fw-bold' : ''; ?>" style="width:8.00em;">セット番号</label>
                    <div class="h4"><span id="SETID_RESULT">NO DATA</span></div>
                </div>

                <div class="mb-4">
                    <label for="QUESTIONID_RESULT" class="form-label h4 py-1 bg-secondary text-center text-white rounded <?php echo ($type != 0) ? 'fw-bold' : ''; ?>" style="width:8.00em;">問題番号</label>
                    <div class="h4"><span id="QUESTIONID_RESULT">NO DATA</span></div>
                </div>

                <div class="mb-4">
                    <label for="ANSWER_RESULT" class="form-label h4 py-1 bg-indigo text-center text-white rounded <?php echo ($type != 0) ? 'fw-bold' : ''; ?>" style="width:8.00em;">解答</label>
                    <div class="h4"><span id="ANSWER_RESULT">NO DATA</span></div>
                </div>

                <div class="mb-4">
                    <label for="ANSWERTIME_RESULT" class="form-label h4 py-1 bg-secondary text-center text-white rounded <?php echo ($type != 0) ? 'fw-bold' : ''; ?>" style="width:8.00em;">解答送信時刻</label>
                    <div class="h4"><span id="ANSWERTIME_RESULT">NO DATA</span></div>
                </div>

                <?php if($type != 0) :?>
                <div class="mb-4">
                    <label for="ANSWERSPEED_RESULT" class="form-label h4 py-1 bg-indigo text-center text-white rounded <?php echo ($type != 0) ? 'fw-bold' : ''; ?>" style="width:8.00em;">解答スピード</label>
                    <div class="h4"><span id="ANSWERSPEED_RESULT">NO DATA</span></div>
                </div>
                <?php endif; ?>
              </div>

              <div class="modal-footer">
                <button id="result-close" type="button" class="btn btn-lg btn-danger <?php echo ($type != 0) ? 'fw-bold' : ''; ?>" data-bs-dismiss="modal">閉じる</button>
              </div>
            </div>
          </div>
        </div>


        <!--送信完了-->
            <div class="position-fixed top-0 start-50 translate-middle-x" style="z-index: 11">
                <div id="toast-done" class="toast align-items-center text-white bg-success border-0 m-3" role="alert" aria-live="assertive" aria-atomic="true" data-bs-delay="2000">
                    <div class="d-flex">
                        <div class="toast-body">
                            <i class="mx-1 bi bi-check-lg"></i>データを送信しました。
                        </div>
                        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                    </div>
                </div>
            </div>

        <!--送信失敗-->
            <div class="position-fixed top-0 start-50 translate-middle-x" style="z-index: 11">
                <div id="toast-failed" class="toast align-items-center text-white bg-danger border-0 m-3" role="alert" aria-live="assertive" aria-atomic="true" data-bs-delay="2000">
                    <div class="d-flex">
                        <div class="toast-body">
                            <i class="mx-1 bi bi-exclamation-triangle"></i>データを送信できませんでした。
                        </div>
                    </div>
                </div>
            </div>

        <!--受付時間外-->
        <div class="position-fixed top-0 start-50 translate-middle-x" style="z-index: 11">
            <div id="toast-outside" class="toast align-items-center text-white bg-danger border-0 m-3" role="alert" aria-live="assertive" aria-atomic="true" data-bs-delay="2000">
                <div class="d-flex">
                    <div class="toast-body">
                        <i class="mx-1 bi bi-exclamation-triangle"></i>受付時間外です。
                    </div>
                </div>
            </div>
        </div>

        <?php require('../component/pagetopbutton.php'); ?>
        <?php require('../component/footer.php'); ?>
        <?php if($type == 0):?>
            <?php require('../component/accountmenu.php'); ?>
        <?php endif;?>

    </main>

</body>

</html>
