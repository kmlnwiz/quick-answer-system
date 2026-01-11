<?php session_start();
require('../dbconnect.php');
require('../islogin.php');
 ?>
<!DOCTYPE html>
<html lang="ja" class="" data-bs-theme="light">

<head>
    <meta charset="UTF-8" />
    <meta http-equiv="content-language" content="ja">
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex">
    <meta http-equiv="Cache-Control" content="no-cache">
    <link rel="apple-touch-icon" href="https://fromtheasia.com/wp-content/uploads/NCG206-510x510.jpg">
    <title>解答データ一覧</title>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.2.0-beta1/dist/js/bootstrap.bundle.min.js" integrity="sha384-pprn3073KE6tl6bjs2QrFaJGz5/SUsLqktiwsUTF55Jfv3qYSDhgCecCxMW52nD2" crossorigin="anonymous"></script>
    <link rel="stylesheet" href="../css/bootstrap.css" crossorigin="anonymous">
    <link rel="stylesheet" href="../css/style.css" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.4.1/jquery.min.js"></script>
    <script src="js/bundle.js" defer></script>
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

<body class="d-flex flex-column touch-none">

    <?php require('../component/loading.php'); ?>
    <?php require('../component/header.php'); ?>

    <main class="flex-shrink-0">
        <div class="container-fluid" style="margin-bottom: 67px!important;">

            <span class="border-bottom h1 d-block py-2 mb-2 touch-none">解答データ一覧</span>

            <div class="row g-1 mt-2">

                <div class="col-12 col-md-4">
                    <div class="mb-3">
                        <?php date_default_timezone_set('Asia/Tokyo');?>
                        <label for="speed-date" class="form-label">日付を選択してください</label>
                        <input class="form-control" type="date" id="speed-date" value="<?php echo date('Y-m-d'); ?>" onChange="tableFilter(ans_data);">
                    </div>
                </div>
                <div class="col-12 col-md-4">
                    <div class="mb-3">
                        <label for="speed-setid" class="form-label">セット番号を入力してください</label>
                        <input type="number" class="form-control text-uppercase" id="speed-setid" maxlength="4" onChange="tableFilter(ans_data);">
                    </div>
                </div>
                <div class="col-12 col-md-4">
                    <div class="mb-3">
                        <label for="speed-questionid" class="form-label">問題番号を選択してください</label>
                        <select class="form-control" id="speed-questionid" onChange="tableFilter(ans_data);">
                                <option value="" selected>全て</option>
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

                <div class="col-12 col-md-4">
                    <div class="mb-3">
                        <label for="max-point" class="form-label">最大ポイント</label>
                        <input type="number" class="form-control text-uppercase" id="max-point" value="70" step="10" onChange="point_data();">
                    </div>
                </div>

                <div class="col-12 col-md-4">
                    <div class="mb-3">
                        <label for="min-point" class="form-label">最小ポイント</label>
                        <input type="number" class="form-control text-uppercase" id="min-point" value="0" step="10" onChange="point_data();">
                    </div>
                </div>

                <div class="col-12 col-md-4">
                    <div class="mb-3">
                        <label for="step" class="form-label">ポイントステップ</label>
                        <input type="number" class="form-control text-uppercase" id="step" value="10" step="5" onChange="point_data();">
                    </div>
                </div>

                <div class="col-12 col-md-6">
                    <div class="mb-3 d-inline-block me-1">
                        <button type="button" class="btn btn-indigo" id="check-all" onClick="checkAll();">全てにチェック</button>
                    </div>
                    <div class="mb-3 d-inline-block">
                        <button type="button" class="btn btn-danger" id="cast-reset" onClick="castReset();">リセット</button>
                    </div>
                </div>

            </div>

            <hr>

            <div id="Content" class="bg-body-tertiary py-2 my-3 px-2 overflow-x-hidden">
                <div class="row g-0">

                    <div class="table-responsive">
                        <table class="table table-striped table-bordered fs-4 table-hover">
                            <thead class="border-secondary-subtle table-active">
                                <tr class="border-bottom">
                                    <th class="position-sticky top-0 text-center" scope="col" style="width:5%;">#</th>
                                    <th class="position-sticky top-0 text-center" scope="col" style="width:20%;">タイムスタンプ</th>
                                    <th class="position-sticky top-0 text-center" scope="col" style="width:10%;">セット番号</th>
                                    <th class="position-sticky top-0 text-center" scope="col" style="width:10%;">問題番号</th>
                                    <th class="position-sticky top-0 text-center" scope="col" style="width:5%;">店舗</th>
                                    <th class="position-sticky top-0 text-center" scope="col" style="width:15%;">名前</th>
                                    <th class="position-sticky top-0 text-center" scope="col" style="width:25%;">解答</th>
                                    <th class="position-sticky top-0 text-center" scope="col" style="width:15%;">解答スピード</th>
                                    <!--<th class="position-sticky top-0 text-center" scope="col" style="width:5%;">IPアドレス</th>-->
                                </tr>
                            </thead>
                            <tbody id="data" class="table-group-divider">
                            </tbody>
                        </table>
                    </div>

                </div>
            </div>
    </main>

    <?php require('../component/pagetopbutton.php'); ?>
    <?php require('../component/footer.php'); ?>
    <?php require('../component/accountmenu.php'); ?>

</body>

</html>
